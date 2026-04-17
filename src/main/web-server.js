// ─── Dax Web Server ─────────────────────────────────────────
// Standalone HTTP + WebSocket server that serves the same React UI
// and bridges to the agent-service backend, mirroring the Electron
// main process IPC layer. Allows browser-based testing without Electron.
//
// Usage: node src/main/web-server.js [--port 3800]
//
// Architecture:
//   Browser ──WebSocket──▸ web-server.js ──IPC──▸ agent-service.js
//   Browser ◂──WebSocket── web-server.js ◂──IPC── agent-service.js

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

// ─── Config ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = portIdx >= 0 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : 3800;

const USER_DATA = process.env.DAX_USER_DATA || path.join(
  process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'),
  'dax'
);
const LOG_DIR = path.join(USER_DATA, 'logs');
const MODELS_DIR = path.join(USER_DATA, 'models');
const LOG_FILE = path.join(LOG_DIR, `dax-web-${new Date().toISOString().slice(0, 10)}.log`);
const DIST_DIR = path.resolve(__dirname, '..', 'renderer', 'dist');

// Ensure directories
for (const dir of [USER_DATA, LOG_DIR, MODELS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Logging ────────────────────────────────────────────────
function log(level, category, message, data = null) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] [${level.toUpperCase()}] [${category}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
  if (level === 'error') console.error(entry);
  else console.log(entry);
  try { fs.appendFileSync(LOG_FILE, entry + '\n'); } catch (_) {}
}

// ─── Agent Service (forked process) ─────────────────────────
let _service = null;
let _serviceReady = false;
const _pendingRequests = new Map();
let _requestId = 0;

// All connected WebSocket clients
const _wsClients = new Set();

// Static file cache — avoids re-reading unchanged assets from disk
const _staticCache = new Map();

function startService() {
  const servicePath = path.join(__dirname, 'agent-service.js');
  log('info', 'SERVICE', 'Forking agent service', { path: servicePath });

  _service = fork(servicePath, [], {
    env: { ...process.env, DAX_USER_DATA: USER_DATA },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  _service.stdout?.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) log('info', 'SERVICE-OUT', msg);
  });

  _service.stderr?.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) log('error', 'SERVICE-ERR', msg);
  });

  _service.on('message', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    const { type, id, result, error, ...rest } = msg;

    // Response to a pending request
    if (type === 'response' && id && _pendingRequests.has(id)) {
      const pending = _pendingRequests.get(id);
      clearTimeout(pending.timeout);
      _pendingRequests.delete(id);
      if (error) pending.reject(new Error(error));
      else pending.resolve(result);
      return;
    }

    if (type === 'service-ready') {
      _serviceReady = true;
      log('info', 'SERVICE', 'Agent service ready');
      return;
    }

    // Broadcast events to all connected WebSocket clients
    if (['run-started', 'run-completed', 'run-step', 'llm-token', 'model-download-progress'].includes(type)) {
      broadcast({ type: 'event', event: type, data: rest });
    }
  });

  _service.on('exit', (code, signal) => {
    log('warn', 'SERVICE', 'Agent service exited', { code, signal });
    _serviceReady = false;
    _service = null;
    for (const [, pending] of _pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Service exited'));
    }
    _pendingRequests.clear();
    // Auto-restart
    log('info', 'SERVICE', 'Restarting service in 2s...');
    setTimeout(startService, 2000);
  });

  _service.on('error', (err) => {
    log('error', 'SERVICE', 'Service error', { error: err.message });
  });
}

// Commands that involve LLM inference get a longer timeout
const LONG_TIMEOUT_CMDS = new Set(['agent-run', 'crews-run', 'mcp-call-tool', 'chat-message']);

function serviceCall(cmd, ...args) {
  return new Promise((resolve, reject) => {
    if (!_service || !_service.connected) {
      return reject(new Error('Agent service not running'));
    }
    const id = `req-${++_requestId}`;
    const ms = LONG_TIMEOUT_CMDS.has(cmd) ? 600000 : 120000; // 10 min vs 2 min
    const timeout = setTimeout(() => {
      _pendingRequests.delete(id);
      reject(new Error(`Service call timed out: ${cmd}`));
    }, ms);
    _pendingRequests.set(id, { resolve, reject, timeout });
    _service.send({ id, cmd, args });
  });
}

// ─── WebSocket ──────────────────────────────────────────────
function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const ws of _wsClients) {
    if (ws.readyState === 1) {
      try { ws.send(payload); } catch (_) {}
    }
  }
}

// ─── IPC Channel Handlers ───────────────────────────────────
// Maps channel names to handler functions, mirroring main.js ipcSafe registrations.
// Handlers receive (...args) from the WebSocket invoke call.

function buildHandlers() {
  const handlers = {};

  // Helper: direct service proxy
  function proxy(channel, cmd) {
    handlers[channel] = (...args) => serviceCall(cmd || channel, ...args);
  }

  // ── Agents ──
  proxy('agents-list');
  proxy('agents-get');
  proxy('agents-create');
  proxy('agents-update');
  proxy('agents-delete');
  proxy('agents-toggle');
  proxy('agent-run');
  proxy('agent-cancel-run');
  proxy('agent-active-runs');

  // ── Runs ──
  proxy('runs-list');
  proxy('runs-get');

  // ── Models ──
  proxy('models-list');
  proxy('models-add');
  proxy('models-delete');
  proxy('models-search-hf');
  proxy('models-download');

  handlers['models-scan-local'] = async () => {
    const files = [];
    if (fs.existsSync(MODELS_DIR)) {
      for (const file of fs.readdirSync(MODELS_DIR)) {
        if (file.toLowerCase().endsWith('.gguf')) {
          const filePath = path.join(MODELS_DIR, file);
          const stats = fs.statSync(filePath);
          files.push({ name: file.replace('.gguf', ''), path: filePath, size: stats.size, modified: stats.mtime.toISOString() });
        }
      }
    }
    return files;
  };

  // ── Scheduler / Tools ──
  proxy('scheduler-status');
  proxy('tools-list');

  // ── Chat ──
  proxy('chat-message');
  proxy('chat-history-list');
  proxy('chat-history-save');
  proxy('chat-history-clear');

  // ── Output Files ──
  proxy('output-files-list');
  proxy('output-files-read');

  // ── Metrics ──
  proxy('get-metrics');

  // ── Integrations ──
  proxy('integrations-list');
  proxy('integration-connect');
  proxy('integration-disconnect');
  proxy('integration-test');
  proxy('integration-action');

  // ── Health ──
  proxy('circuit-status');
  proxy('error-budget-status');

  // ── Webhooks ──
  proxy('webhook-generate-token');
  proxy('webhook-get-info');

  // ── Crews ──
  proxy('crews-list');
  proxy('crews-get');
  proxy('crews-create');
  proxy('crews-update');
  proxy('crews-delete');
  proxy('crews-run');

  // ── MCP ──
  proxy('mcp-add-server');
  proxy('mcp-remove-server');
  proxy('mcp-list-servers');
  proxy('mcp-server-tools');
  proxy('mcp-call-tool');

  // ── Settings ──
  proxy('settings-get');
  proxy('settings-set');
  proxy('settings-all');

  // ── Knowledge Base ──
  proxy('kb-list');
  proxy('kb-get');
  proxy('kb-create');
  proxy('kb-delete');
  proxy('kb-ingest');
  proxy('kb-query');
  proxy('kb-delete-doc');
  proxy('kb-ensure-model');

  // ── Plugins ──
  proxy('plugins-list');
  proxy('plugins-discover');
  proxy('plugins-load');
  proxy('plugins-unload');

  // ── System / Utility (handled locally, not via service) ──
  handlers['system-info'] = async () => {
    const os = require('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      hostname: os.hostname(),
      nodeVersion: process.version,
    };
  };
  handlers['get-models-dir'] = async () => MODELS_DIR;
  handlers['get-user-data'] = async () => USER_DATA;
  handlers['get-log-path'] = async () => LOG_FILE;
  handlers['get-recent-logs'] = async (lines = 100) => {
    try {
      const logPath = path.join(LOG_DIR, `dax-service-${new Date().toISOString().slice(0, 10)}.log`);
      if (!fs.existsSync(logPath)) return '';
      const content = fs.readFileSync(logPath, 'utf-8');
      return content.split('\n').slice(-lines).join('\n');
    } catch (_) { return ''; }
  };
  handlers['plugins-dir'] = async () => path.join(USER_DATA, 'plugins');

  // OAuth — proxy to real agent-service. Browser receives auth URL to open in a new tab.
  proxy('oauth-start');
  proxy('oauth-providers');
  proxy('oauth-callback');
  proxy('credentials-list');
  proxy('credentials-delete');

  // Voice — proxy real transcription/synthesis through the service (Whisper / whisper.cpp / TTS).
  proxy('voice-configure');
  proxy('voice-get-config');
  proxy('voice-transcribe');
  proxy('voice-synthesize');

  // Window controls — no-ops in browser mode (no native frame).
  handlers['win-minimize'] = async () => ({ noop: true });
  handlers['win-maximize'] = async () => ({ noop: true });
  handlers['win-close'] = async () => ({ noop: true });
  handlers['win-is-maximized'] = async () => false;

  // Dialogs — browser uses HTML <input type="file" /> instead; signal unsupported so UI falls back.
  handlers['dialog-open-folder'] = async () => ({ unsupported: true, reason: 'browser-mode' });
  handlers['dialog-open-file'] = async () => ({ unsupported: true, reason: 'browser-mode' });
  handlers['kb-select-file'] = async () => ({ unsupported: true, reason: 'browser-mode' });
  handlers['shell-open-external'] = async (url) => ({ openUrl: url });

  // Agent import/export — browser POSTs file content, no native dialog required.
  handlers['agent-export'] = async (id) => {
    const agent = await serviceCall('agents-get', id);
    if (!agent) throw new Error('Agent not found');
    return { version: 1, type: 'dax-agent', exported_at: new Date().toISOString(), agent };
  };
  handlers['agent-import'] = async (payload) => {
    if (!payload || typeof payload !== 'object') throw new Error('Import payload required');
    const agent = payload.agent || payload;
    if (!agent.name) throw new Error('Invalid agent import: missing name');
    return serviceCall('agents-create', agent);
  };

  return handlers;
}

// ─── MIME Types ─────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.wasm': 'application/wasm',
  '.map':  'application/json',
};

// ─── HTTP Server ────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Health check
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', serviceReady: _serviceReady, uptime: process.uptime() }));
    return;
  }

  // Serve static files from renderer dist
  let filePath;
  if (req.url === '/' || req.url === '/index.html') {
    filePath = path.join(DIST_DIR, 'index.html');
  } else {
    // Sanitize path to prevent directory traversal
    const safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[\/\\])+/, '');
    filePath = path.join(DIST_DIR, safePath);
  }

  // Ensure we don't serve files outside DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // SPA fallback: serve index.html for non-file routes
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found — run "npm run build:renderer" first');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    // Use cached content for static assets; skip cache for index.html (SPA, may change)
    let content;
    const isIndexHtml = filePath.endsWith('index.html');
    if (!isIndexHtml && _staticCache.has(filePath)) {
      content = _staticCache.get(filePath);
    } else {
      content = fs.readFileSync(filePath);
      if (!isIndexHtml) _staticCache.set(filePath, content);
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// ─── WebSocket Server ───────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });
const handlers = buildHandlers();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  _wsClients.add(ws);
  log('info', 'WS', 'Client connected', { clients: _wsClients.size });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    if (msg.type === 'invoke') {
      const { id, channel, args = [] } = msg;
      const handler = handlers[channel];
      if (!handler) {
        ws.send(JSON.stringify({ type: 'response', id, error: `Unknown channel: ${channel}` }));
        return;
      }
      try {
        const result = await handler(...args);
        ws.send(JSON.stringify({ type: 'response', id, result }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'response', id, error: err.message }));
      }
    }
  });

  ws.on('close', () => {
    _wsClients.delete(ws);
    log('info', 'WS', 'Client disconnected', { clients: _wsClients.size });
  });

  ws.on('error', (err) => {
    log('error', 'WS', 'WebSocket error', { error: err.message });
    _wsClients.delete(ws);
  });
});

// ─── Startup ────────────────────────────────────────────────
function start() {
  log('info', 'WEB', 'Starting Dax web server', { port: PORT, dist: DIST_DIR });

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    log('warn', 'WEB', 'Renderer dist not found — run "npm run build:renderer" first', { dist: DIST_DIR });
  }

  startService();

  server.listen(PORT, () => {
    log('info', 'WEB', `Dax web server running`, { url: `http://localhost:${PORT}`, ws: `ws://localhost:${PORT}/ws` });
    console.log('');
    console.log(`  Dax Web Server`);
    console.log(`  ─────────────`);
    console.log(`  UI:        http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`  Health:    http://localhost:${PORT}/api/health`);
    console.log('');
  });
}

// ─── Shutdown ───────────────────────────────────────────────
process.on('SIGINT', () => {
  log('info', 'WEB', 'Shutting down...');
  if (_service) {
    try { _service.send({ cmd: 'shutdown' }); } catch (_) {}
    setTimeout(() => {
      if (_service) {
        try { _service.kill('SIGKILL'); } catch (_) {}
      }
      process.exit(0);
    }, 5000);
  } else {
    process.exit(0);
  }
});

start();
