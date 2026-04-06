'use strict';

/**
 * Dax — Electron Main Process
 * Privacy-first AI Agent Platform
 * 
 * IPC-based architecture — no HTTP server, no WebSocket.
 * All renderer ↔ main communication goes through Electron IPC.
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// ─── Logging ────────────────────────────────────────────────
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(LOG_DIR, `dax-${new Date().toISOString().slice(0, 10)}.log`);

function log(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
  
  // Console output
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
  
  // File output
  try {
    fs.appendFileSync(LOG_FILE, entry + '\n');
  } catch (_) {}
}

// ─── Global Error Handlers ──────────────────────────────────
process.on('uncaughtException', (error) => {
  log('error', 'PROCESS', 'Uncaught exception', { 
    message: error.message, 
    stack: error.stack 
  });
});

process.on('unhandledRejection', (reason) => {
  log('error', 'PROCESS', 'Unhandled promise rejection', { 
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason)
  });
});

// ─── Constants ──────────────────────────────────────────────
const IS_DEV = !app.isPackaged;
const DEV_URL = 'http://localhost:5199';
const PROD_PATH = path.join(__dirname, '..', 'renderer', 'dist', 'index.html');
const USER_DATA = app.getPath('userData');
const DB_PATH = path.join(USER_DATA, 'dax.db');
const MODELS_DIR = path.join(USER_DATA, 'models');
const PLUGINS_DIR = path.join(USER_DATA, 'plugins');
const CREDS_DIR = path.join(USER_DATA, 'credentials');

// ─── OAuth & Credential Store ───────────────────────────────
const oauthManager = require('./engine/oauth-manager');
const { CredentialStore } = require('./credential-store');
const credentialStore = new CredentialStore(CREDS_DIR);

// State for in-flight OAuth flows: state → { verifier, integrationId, providerId, clientId, clientSecret, redirectUri }
const _pendingOAuth = new Map();

log('info', 'INIT', 'Dax starting', { IS_DEV, USER_DATA, DB_PATH, pid: process.pid });

// ─── Ensure directories exist ───────────────────────────────
for (const dir of [MODELS_DIR, PLUGINS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log('info', 'INIT', `Created directory: ${dir}`);
  }
}

// ─── Single instance lock ───────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;

function loadWindowErrorPage(title, message, details = '') {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const html = `<!doctype html>
<html>
  <body style="background:#0A0A0A;color:#EAEAEA;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;box-sizing:border-box;">
    <div style="max-width:720px;background:#121212;border:1px solid #2A2A2A;border-radius:16px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,0.35);">
      <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#FF6B00;margin-bottom:12px;">Dax Startup Error</div>
      <h1 style="margin:0 0 12px 0;font-size:28px;line-height:1.2;">${title}</h1>
      <p style="margin:0 0 16px 0;color:#B8B8B8;line-height:1.5;">${message}</p>
      ${details ? `<pre style="margin:0;padding:16px;border-radius:12px;background:#0A0A0A;border:1px solid #2A2A2A;color:#9DA3AE;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;">${details}</pre>` : ''}
    </div>
  </body>
</html>`;

  return mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

// ─── Create Window ──────────────────────────────────────────
function createWindow() {
  log('info', 'WINDOW', 'Creating main window');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  log('info', 'WINDOW', 'Preload path', { preload: path.join(__dirname, 'preload.js') });

  // Load content
  if (IS_DEV) {
    log('info', 'WINDOW', `Loading dev URL: ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL).catch((err) => {
      log('error', 'WINDOW', 'Failed to load dev URL', { error: err.message });
      loadWindowErrorPage(
        'Renderer dev server unavailable',
        'The renderer dev server is not running on port 5199.',
        'Run: cd dax/src/renderer && npx vite --port 5199'
      );
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    log('info', 'WINDOW', `Loading production file: ${PROD_PATH}`);
    if (!fs.existsSync(PROD_PATH)) {
      log('error', 'WINDOW', 'Production file missing', { path: PROD_PATH });
      loadWindowErrorPage(
        'Packaged UI files are missing',
        'Dax cannot start because the production renderer build was not found.',
        `Expected file:\n${PROD_PATH}\n\nReinstall Dax or rebuild the renderer bundle before launching the packaged app.`
      );
    } else {
      mainWindow.loadFile(PROD_PATH).catch((err) => {
        log('error', 'WINDOW', 'Failed to load production file', { error: err.message, path: PROD_PATH });
        loadWindowErrorPage(
          'Packaged UI failed to load',
          'Dax found the production renderer file, but Electron could not load it.',
          `${err.message}\n\nFile: ${PROD_PATH}`
        );
      });
    }
  }

  // Log renderer errors
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const levels = ['debug', 'info', 'warn', 'error'];
    const levelName = levels[level] || 'info';
    if (level >= 2) { // warn and error only
      log(levelName, 'RENDERER', message, { line, source: sourceId });
    }
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log('error', 'RENDERER', 'Render process gone', details);
  });

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    log('error', 'WINDOW', 'Page failed to load', { errorCode, errorDescription });
  });

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    log('info', 'WINDOW', 'Window ready to show');
    mainWindow.show();
  });

  // Set CSP for production builds
  if (!IS_DEV) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'"
          ],
        },
      });
    });
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── System Tray ────────────────────────────────────────────
function createTrayIcon(status = 'running') {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  // Color based on status: orange=running, green=active, red=error, gray=stopped
  const colors = {
    running: [255, 107, 0],   // orange
    active:  [0, 200, 83],    // green
    error:   [220, 38, 38],   // red
    stopped: [120, 120, 120], // gray
  };
  const [r, g, b] = colors[status] || colors.running;
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function updateTrayMenu() {
  if (!tray) return;
  const statusLabel = _serviceReady ? 'Service: Running' : 'Service: Starting...';
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Dax', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); } } },
    { type: 'separator' },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Run Agent...', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', '/agents'); } },
    { label: 'View Runs', click: () => { mainWindow?.show(); mainWindow?.webContents.send('navigate', '/runs'); } },
    { type: 'separator' },
    { label: 'Restart Service', click: () => {
      if (_service) { try { _service.kill(); } catch (_) {} }
      else startService();
    }},
    { type: 'separator' },
    { label: 'Quit Dax', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(_serviceReady ? 'Dax — Agents Running' : 'Dax — Starting...');
}

function createTray() {
  try {
    tray = new Tray(createTrayIcon('running'));
    updateTrayMenu();
    tray.on('double-click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); }
    });
    log('info', 'TRAY', 'System tray created');
  } catch (err) {
    log('error', 'TRAY', 'Failed to create system tray', { error: err.message });
  }
}

// ─── IPC Handlers: Window Controls ─────────────────────────
// Wrapper for safe IPC handling with logging and optional Zod validation.
// schema: a Zod schema (or null). When provided and args[0] is the payload,
// validation runs before the handler. For tuple schemas pass z.tuple([...]).
function ipcSafe(channel, handler, schema = null) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (schema) {
      const parsed = schema.safeParse(args.length === 1 ? args[0] : args);
      if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        log('warn', 'IPC', `Validation failed: ${channel}`, { errors: msg });
        throw new Error(`Invalid input: ${msg}`);
      }
    }
    try {
      const result = await handler(event, ...args);
      return result;
    } catch (err) {
      log('error', 'IPC', `Handler failed: ${channel}`, { error: err.message, stack: err.stack });
      throw err;
    }
  });
}

// Load IPC schemas (Zod)
const schemas = require('./ipc-schemas');

ipcSafe('win-minimize', () => mainWindow?.minimize());
ipcSafe('win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcSafe('win-close', () => mainWindow?.close());
ipcSafe('win-is-maximized', () => mainWindow?.isMaximized());

// ─── IPC Handlers: Dialogs ─────────────────────────────────
ipcSafe('dialog-open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcSafe('dialog-open-file', async (_e, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcSafe('kb-select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md', 'csv', 'json', 'html', 'htm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcSafe('shell-open-external', (_e, url) => {
  // Validate URL to prevent arbitrary code execution
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return shell.openExternal(url);
    }
  } catch (_) {}
  return null;
});

// ─── Background Agent Service ───────────────────────────────
// All DB, scheduling, execution, and integration logic runs in a forked
// child process (agent-service.js). Electron main acts as a thin proxy
// between the renderer IPC and the service process.

const { fork } = require('child_process');

let _service = null;
let _serviceReady = false;
const _pendingRequests = new Map(); // id → { resolve, reject, timeout }
let _requestId = 0;

function startService() {
  const servicePath = path.join(__dirname, 'agent-service.js');
  log('info', 'SERVICE', 'Forking agent service', { path: servicePath });

  _service = fork(servicePath, [], {
    env: { ...process.env, DAX_USER_DATA: USER_DATA },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });

  _service.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log('info', 'SERVICE-OUT', msg);
  });

  _service.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) log('error', 'SERVICE-ERR', msg);
  });

  _service.on('message', (msg) => {
    const { type, id, result, error, ...rest } = msg;

    if (type === 'response' && id && _pendingRequests.has(id)) {
      const pending = _pendingRequests.get(id);
      _pendingRequests.delete(id);
      clearTimeout(pending.timeout);
      if (error) pending.reject(new Error(error));
      else pending.resolve(result);
      return;
    }

    if (type === 'service-ready') {
      _serviceReady = true;
      log('info', 'SERVICE', 'Agent service ready', rest);
      if (tray) { tray.setImage(createTrayIcon('active')); updateTrayMenu(); }
      return;
    }

    if (type === 'heartbeat') {
      // Service is alive
      _lastHeartbeat = Date.now();
      return;
    }

    if (type === 'run-started') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('run-started', rest);
      }
      return;
    }

    if (type === 'run-completed') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('run-completed', rest);
      }
      return;
    }

    if (type === 'run-step') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('run-step', rest);
      }
      return;
    }

    if (type === 'model-download-progress') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('model-download-progress', rest);
      }
      return;
    }

    if (type === 'log') {
      // Service log forwarding (optional — already goes to service log file)
      return;
    }
  });

  _service.on('exit', (code, signal) => {
    log('warn', 'SERVICE', `Agent service exited`, { code, signal });
    _serviceReady = false;
    _service = null;
    if (tray) { tray.setImage(createTrayIcon('error')); updateTrayMenu(); }
    // Reject all pending requests
    for (const [id, pending] of _pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Service exited'));
    }
    _pendingRequests.clear();
    // Auto-restart after 2s if not quitting
    if (!app.isQuitting) {
      log('info', 'SERVICE', 'Auto-restarting service in 2s...');
      setTimeout(startService, 2000);
    }
  });

  _service.on('error', (err) => {
    log('error', 'SERVICE', 'Service process error', { error: err.message });
  });
}

// Send a command to the service and wait for response
function serviceCall(cmd, ...args) {
  return new Promise((resolve, reject) => {
    if (!_service || !_service.connected) {
      reject(new Error('Agent service not connected'));
      return;
    }
    const id = ++_requestId;
    const timeout = setTimeout(() => {
      _pendingRequests.delete(id);
      reject(new Error(`Service call timeout: ${cmd}`));
    }, 120000); // 2 min timeout for long-running agents
    _pendingRequests.set(id, { resolve, reject, timeout });
    _service.send({ id, cmd, args });
  });
}

let _lastHeartbeat = Date.now();

// Health check — restart service if heartbeat missed
function startHealthCheck() {
  setInterval(() => {
    if (!app.isQuitting && _serviceReady && Date.now() - _lastHeartbeat > 90000) {
      log('warn', 'SERVICE', 'Heartbeat missed — restarting service');
      if (_service) { try { _service.kill(); } catch (_) {} }
    }
  }, 30000);
}

// ─── IPC: Agent CRUD (proxied to service) ──────────────────
ipcSafe('agents-list', () => serviceCall('agents-list'));
ipcSafe('agents-get', (_e, id) => serviceCall('agents-get', id));
ipcSafe('agents-create', (_e, agent) => serviceCall('agents-create', agent), schemas.agentsCreate);
ipcSafe('agents-update', (_e, id, updates) => serviceCall('agents-update', id, updates), schemas.agentsUpdate);
ipcSafe('agents-delete', (_e, id) => serviceCall('agents-delete', id));
ipcSafe('agents-toggle', (_e, id) => serviceCall('agents-toggle', id));

// ─── IPC: Import/Export ─────────────────────────────────────
ipcSafe('agent-export', async (_e, id) => {
  const agent = await serviceCall('agents-get', id);
  if (!agent) throw new Error('Agent not found');

  const exportData = {
    version: 1,
    type: 'dax-agent',
    exported_at: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description,
      trigger_type: agent.trigger_type,
      trigger_config: agent.trigger_config,
      nodes: agent.nodes,
      edges: agent.edges,
      system_prompt: agent.system_prompt,
      temperature: agent.temperature,
      max_retries: agent.max_retries,
      token_budget: agent.token_budget,
    },
  };

  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Agent',
    defaultPath: `${agent.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.dax.json`,
    filters: [{ name: 'Dax Agent', extensions: ['dax.json', 'json'] }],
  });

  if (!filePath) return { cancelled: true };
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  log('info', 'EXPORT', `Exported agent "${agent.name}" to ${filePath}`);
  return { success: true, path: filePath };
});

ipcSafe('agent-import', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Import Agent',
    filters: [{ name: 'Dax Agent', extensions: ['dax.json', 'json'] }],
    properties: ['openFile'],
  });

  if (!filePaths || filePaths.length === 0) return { cancelled: true };

  const raw = fs.readFileSync(filePaths[0], 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (data.type !== 'dax-agent' || !data.agent) {
    throw new Error('Not a valid Dax agent file');
  }

  const a = data.agent;
  const result = await serviceCall('agents-create', {
    name: a.name || 'Imported Agent',
    description: a.description || '',
    trigger_type: a.trigger_type || 'manual',
    trigger_config: typeof a.trigger_config === 'string' ? JSON.parse(a.trigger_config) : (a.trigger_config || {}),
    nodes: typeof a.nodes === 'string' ? JSON.parse(a.nodes) : (a.nodes || []),
    edges: typeof a.edges === 'string' ? JSON.parse(a.edges) : (a.edges || []),
    system_prompt: a.system_prompt || '',
    temperature: a.temperature ?? 0.7,
    max_retries: a.max_retries ?? 3,
    token_budget: a.token_budget ?? 4096,
  });

  log('info', 'IMPORT', `Imported agent "${a.name}" from ${filePaths[0]}`);
  return result;
});

// ─── IPC: Runs (proxied to service) ─────────────────────────
ipcSafe('runs-list', (_e, agentId, limit = 50) => serviceCall('runs-list', agentId, limit));
ipcSafe('runs-get', (_e, id) => serviceCall('runs-get', id));

// ─── IPC: Models (proxied to service) ───────────────────────
ipcSafe('models-list', () => serviceCall('models-list'));

ipcSafe('models-scan-local', () => {
  // Scan MODELS_DIR for .gguf files (stays local — filesystem access)
  const files = [];
  if (fs.existsSync(MODELS_DIR)) {
    for (const file of fs.readdirSync(MODELS_DIR)) {
      if (file.toLowerCase().endsWith('.gguf')) {
        const filePath = path.join(MODELS_DIR, file);
        const stats = fs.statSync(filePath);
        files.push({
          name: file.replace('.gguf', ''),
          path: filePath,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }
  }
  return files;
});

ipcSafe('models-add', (_e, model) => serviceCall('models-add', model), schemas.modelsAdd);
ipcSafe('models-delete', (_e, id) => serviceCall('models-delete', id));
ipcSafe('models-search-hf', (_e, opts) => serviceCall('models-search-hf', opts));
ipcSafe('models-download', (_e, opts) => serviceCall('models-download', opts));

// ─── IPC: Settings (proxied to service) ─────────────────────
ipcSafe('settings-get', (_e, key) => serviceCall('settings-get', key));
ipcSafe('settings-set', (_e, key, value) => serviceCall('settings-set', key, value), schemas.settingsSet);
ipcSafe('settings-all', () => serviceCall('settings-all'));

// ─── IPC: System Info ───────────────────────────────────────
ipcSafe('system-info', () => {
  const os = require('os');
  return {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
    userDataPath: USER_DATA,
    modelsDir: MODELS_DIR,
    dbPath: DB_PATH,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    },
  };
});

// ─── IPC: Paths ─────────────────────────────────────────────
ipcSafe('get-models-dir', () => MODELS_DIR);
ipcSafe('get-user-data', () => USER_DATA);

// ─── IPC: Logs ──────────────────────────────────────────────
ipcSafe('get-log-path', () => LOG_FILE);
ipcSafe('get-recent-logs', (_e, lines = 100) => {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const safeLines = Math.min(Math.max(1, Number.isInteger(lines) ? lines : 100), 10000);
    return content.split('\n').filter(Boolean).slice(-safeLines);
  } catch {
    return [];
  }
}, schemas.getRecentLogs);

// ─── Agent Execution Engine (proxied to service) ────────────
ipcSafe('agent-run', (_e, agentId, triggerData) => serviceCall('agent-run', agentId, triggerData), schemas.agentRun);
ipcSafe('agent-cancel-run', (_e, runId) => serviceCall('agent-cancel-run', runId));
ipcSafe('agent-active-runs', () => serviceCall('agent-active-runs'));
ipcSafe('tools-list', () => serviceCall('tools-list'));
ipcSafe('scheduler-status', () => serviceCall('scheduler-status'));

// ─── MCP Client (proxied to service) ────────────────────────
ipcSafe('mcp-add-server', (_e, config) => serviceCall('mcp-add-server', config), schemas.mcpAddServer);
ipcSafe('mcp-remove-server', (_e, id) => serviceCall('mcp-remove-server', id));
ipcSafe('mcp-list-servers', () => serviceCall('mcp-list-servers'));
ipcSafe('mcp-server-tools', (_e, serverId) => serviceCall('mcp-server-tools', serverId));
ipcSafe('mcp-call-tool', (_e, toolName, args) => serviceCall('mcp-call-tool', toolName, args), schemas.mcpCallTool);

// ─── Integrations (proxied to service) ──────────────────────
ipcSafe('integrations-list', () => serviceCall('integrations-list'));
ipcSafe('integration-connect', async (_e, integrationId, credentials) => {
  const result = await serviceCall('integration-connect', integrationId, credentials);
  // Persist non-OAuth manual credentials
  credentialStore.set(integrationId, { credentials, providerId: null, oauthMeta: null });
  return result;
}, schemas.integrationConnect);
ipcSafe('integration-disconnect', async (_e, integrationId) => {
  const result = await serviceCall('integration-disconnect', integrationId);
  credentialStore.delete(integrationId);
  return result;
});
ipcSafe('integration-test', (_e, integrationId, credentials) => serviceCall('integration-test', integrationId, credentials));
ipcSafe('integration-action', (_e, integrationId, actionName, params) => serviceCall('integration-action', integrationId, actionName, params), schemas.integrationAction);

// ─── OAuth Flows ─────────────────────────────────────────────

/**
 * Handle the dax://oauth/callback URL after the user authenticates.
 * Exchanges the code for tokens, persists them, and connects the integration.
 */
async function handleOAuthCallback(url) {
  log('info', 'OAUTH', 'Received callback URL', { url: url.replace(/code=[^&]+/, 'code=***') });
  try {
    const { code, state, error } = oauthManager.parseCallback(url);
    if (error) throw new Error(`OAuth provider error: ${error}`);
    if (!state || !_pendingOAuth.has(state)) {
      log('warn', 'OAUTH', 'Unknown or expired OAuth state', { state });
      mainWindow?.webContents.send('oauth-error', { error: 'Unknown or expired OAuth state. Please try again.' });
      return;
    }
    const pending = _pendingOAuth.get(state);
    _pendingOAuth.delete(state);
    const { verifier, integrationId, providerId, clientId, clientSecret, redirectUri } = pending;

    // Exchange code for tokens
    const tokens = await oauthManager.exchangeCode(providerId, clientId, clientSecret, code, verifier, redirectUri);
    const credentials = oauthManager.mapTokensToCredentials(providerId, integrationId, tokens, { shop: oauthManager.parseCallback(url).shop });
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;

    // Persist encrypted
    credentialStore.set(integrationId, {
      credentials,
      providerId,
      oauthMeta: { clientId, clientSecret: clientSecret || null, refreshToken: tokens.refresh_token || null, expiresAt, redirectUri },
    });

    // Connect integration in agent-service
    await serviceCall('integration-connect', integrationId, credentials);

    log('info', 'OAUTH', `OAuth connected: ${integrationId}`);
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send('oauth-success', { integrationId, providerId });
  } catch (err) {
    log('error', 'OAUTH', 'OAuth callback failed', { error: err.message });
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send('oauth-error', { error: err.message });
  }
}

// IPC: Start OAuth flow — opens browser for user authorization
ipcSafe('oauth-start', async (_e, oauthArgs) => {
  const { providerId, integrationId, clientId, clientSecret, options } = oauthArgs;
  if (!providerId || !integrationId || !clientId) throw new Error('providerId, integrationId, and clientId are required');
  const { verifier, challenge, state } = oauthManager.generatePKCE();
  const redirectUri = 'dax://oauth/callback';
  const authUrl = oauthManager.buildAuthUrl(providerId, clientId, redirectUri, challenge, state, options);
  _pendingOAuth.set(state, { verifier, integrationId, providerId, clientId, clientSecret, redirectUri });
  // Clean up stale pending flows after 10 minutes
  setTimeout(() => _pendingOAuth.delete(state), 600_000);
  shell.openExternal(authUrl);
  log('info', 'OAUTH', `OAuth flow started: ${providerId} → ${integrationId}`);
  return { state, authUrl };
}, schemas.oauthStart);

// IPC: List available OAuth providers
ipcSafe('oauth-providers', () =>
  Object.entries(oauthManager.PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    requiresSecret: p.requiresSecret,
    defaultScopes: p.defaultScopes,
    supportedIntegrations: Object.keys(p.integrations || {}),
  }))
);

// IPC: List stored credentials (no secrets — just metadata)
ipcSafe('credentials-list', () => credentialStore.list());

// IPC: Delete stored credentials
ipcSafe('credentials-delete', async (_e, integrationId) => {
  credentialStore.delete(integrationId);
  try { await serviceCall('integration-disconnect', integrationId); } catch (_) {}
  return { success: true };
});

// IPC: Circuit breaker and error budget monitoring
ipcSafe('circuit-status', () => serviceCall('circuit-status'));
ipcSafe('error-budget-status', (_e, integrationId) => serviceCall('error-budget-status', integrationId));

// ─── Webhooks (proxied to service) ──────────────────────────
ipcSafe('webhook-generate-token', (_e, agentId) => serviceCall('webhook-generate-token', agentId));
ipcSafe('webhook-get-info', (_e, agentId) => serviceCall('webhook-get-info', agentId));

// ─── Crews / Multi-Agent (proxied to service) ───────────────
ipcSafe('crews-list', () => serviceCall('crews-list'));
ipcSafe('crews-get', (_e, id) => serviceCall('crews-get', id));
ipcSafe('crews-create', (_e, crew) => serviceCall('crews-create', crew), schemas.crewsCreate);
ipcSafe('crews-update', (_e, id, updates) => serviceCall('crews-update', id, updates), schemas.crewsUpdate);
ipcSafe('crews-delete', (_e, id) => serviceCall('crews-delete', id));
ipcSafe('crews-run', (_e, crewId, triggerData) => serviceCall('crews-run', crewId, triggerData), schemas.crewsRun);

// ─── Voice Engine (local — uses audio APIs) ─────────────────
const { voiceEngine, setLogger: setVoiceLogger } = require('./engine/voice-engine');
setVoiceLogger((level, category, msg, data) => log(level, category, msg, data));

ipcSafe('voice-configure', (_e, settings) => {
  voiceEngine.configure(settings);
  return { success: true };
}, schemas.voiceConfigure);

ipcSafe('voice-get-config', () => {
  return voiceEngine.getConfig();
});

ipcSafe('voice-transcribe', async (_e, audioBase64) => {
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  return voiceEngine.transcribe(audioBuffer);
}, schemas.voiceTranscribe);

ipcSafe('voice-synthesize', async (_e, text) => {
  const result = await voiceEngine.synthesize(text);
  if (Buffer.isBuffer(result)) {
    return { audio: result.toString('base64'), format: 'wav' };
  }
  return result;
});

// ─── Plugin System (local — manages filesystem) ─────────────
const { PluginManager, setLogger: setPluginLogger } = require('./engine/plugin-loader');
setPluginLogger((level, category, msg, data) => log(level, category, msg, data));

const pluginsDir = path.join(app.getPath('userData'), 'plugins');
const pluginManager = new PluginManager(pluginsDir);

ipcSafe('plugins-list', () => pluginManager.list());
ipcSafe('plugins-discover', () => pluginManager.discover());

ipcSafe('plugins-load', async (_e, pluginId) => {
  const discovered = await pluginManager.discover();
  const manifest = discovered.find((d) => d.id === pluginId);
  if (!manifest) throw new Error(`Plugin not found: ${pluginId}`);
  await pluginManager.loadPlugin(manifest);
  return { success: true };
});

ipcSafe('plugins-unload', async (_e, pluginId) => {
  await pluginManager.unloadPlugin(pluginId);
  return { success: true };
});

ipcSafe('plugins-dir', () => pluginsDir);

// ─── Knowledge Base / RAG (proxied to service) ──────────────
ipcSafe('kb-list',   () => serviceCall('kb-list'));
ipcSafe('kb-get',    (_e, id) => serviceCall('kb-get', id));
ipcSafe('kb-create', (_e, data) => serviceCall('kb-create', data), schemas.kbCreate);
ipcSafe('kb-delete', (_e, id) => serviceCall('kb-delete', id));
ipcSafe('kb-ingest', (_e, data) => serviceCall('kb-ingest', data), schemas.kbIngest);
ipcSafe('kb-query',  (_e, data) => serviceCall('kb-query', data), schemas.kbQuery);
ipcSafe('kb-delete-doc', (_e, data) => serviceCall('kb-delete-doc', data), schemas.kbDeleteDoc);
ipcSafe('kb-ensure-model', (_e, model) => serviceCall('kb-ensure-model', model), schemas.kbEnsureModel);

// ─── Chat (ephemeral LLM) ───────────────────────────────────
ipcSafe('chat-message', (_e, data) => serviceCall('chat-message', data), schemas.chatMessage);
ipcSafe('chat-history-list', (_e, limit) => serviceCall('chat-history-list', limit));
ipcSafe('chat-history-save', (_e, msg) => serviceCall('chat-history-save', msg));
ipcSafe('chat-history-clear', () => serviceCall('chat-history-clear'));

// ─── Auto Updater ───────────────────────────────────────────
ipcSafe('update-check', () => {
  if (!IS_DEV) autoUpdater.checkForUpdates();
  return { checking: !IS_DEV };
});

ipcSafe('update-download', () => {
  autoUpdater.downloadUpdate();
  return { downloading: true };
});

ipcSafe('update-install', () => {
  autoUpdater.quitAndInstall(false, true);
});

function setupAutoUpdater() {
  if (IS_DEV) return; // No update checks in development

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: (m) => log('info', 'UPDATER', m), warn: (m) => log('warn', 'UPDATER', m), error: (m) => log('error', 'UPDATER', m) };

  function sendStatus(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', payload);
    }
  }

  autoUpdater.on('checking-for-update', () => {
    log('info', 'UPDATER', 'Checking for updates');
    sendStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    log('info', 'UPDATER', `Update available: ${info.version}`, { releaseDate: info.releaseDate });
    sendStatus({ status: 'available', version: info.version, releaseDate: info.releaseDate });
  });

  autoUpdater.on('update-not-available', () => {
    log('info', 'UPDATER', 'No updates available');
    sendStatus({ status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({ status: 'downloading', percent: Math.round(progress.percent), bytesPerSecond: progress.bytesPerSecond });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log('info', 'UPDATER', `Update downloaded: ${info.version}`);
    sendStatus({ status: 'ready', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    log('error', 'UPDATER', 'Update error', { error: err.message });
    sendStatus({ status: 'error', message: err.message });
  });

  // Check on startup (slight delay to let window render first)
  setTimeout(() => autoUpdater.checkForUpdates(), 5000);
}

// ─── App Lifecycle ───────────────────────────────────────────
// Auto-launch on login (configurable via settings)
if (!IS_DEV) {
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ['--hidden'],
  });
}

app.on('ready', () => {
  log('info', 'APP', 'App ready event fired');

  // If launched with --hidden (auto-launch), skip showing window
  const launchHidden = process.argv.includes('--hidden');

  createWindow();
  if (launchHidden && mainWindow) {
    mainWindow.hide();
    log('info', 'APP', 'Launched hidden (auto-start)');
  }

  createTray();

  // Register custom protocol for OAuth callbacks (dax://)
  if (!app.isDefaultProtocolClient('dax')) {
    app.setAsDefaultProtocolClient('dax');
    log('info', 'OAUTH', 'Registered dax:// protocol handler');
  }

  // Start the background agent service
  startService();
  startHealthCheck();

  // Restore previously-connected integrations from encrypted storage
  _restoreCredentials();

  // Load plugins (local to main process)
  pluginManager.loadAll().then(() => {
    log('info', 'PLUGINS', 'Plugin system initialized');
  }).catch((err) => {
    log('error', 'PLUGINS', 'Failed to load plugins', { error: err.message });
  });

  log('info', 'APP', 'Initialization complete');

  // Start auto-updater (production only)
  setupAutoUpdater();
});

// ─── OAuth deep-link callback (Windows/Linux — comes as second instance) ───
app.on('second-instance', (_event, argv) => {
  const callbackUrl = argv.find((arg) => arg.startsWith('dax://oauth/'));
  if (callbackUrl) {
    handleOAuthCallback(callbackUrl);
    return;
  }
  log('info', 'APP', 'Second instance detected, focusing existing window');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// OAuth deep-link callback (macOS — comes as open-url event)
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('dax://oauth/')) handleOAuthCallback(url);
});

/**
 * On startup, reload all persisted integration credentials.
 * For OAuth tokens near expiry, attempt a token refresh first.
 * Must be called after startService() so the service process exists.
 */
async function _restoreCredentials() {
  const stored = credentialStore.list();
  if (stored.length === 0) return;
  log('info', 'CREDS', `Restoring ${stored.length} stored integration(s)`);
  for (const { integrationId } of stored) {
    try {
      const record = credentialStore.get(integrationId);
      if (!record) continue;
      let { credentials, oauthMeta } = record;

      // Refresh OAuth token if expired (or expiring in 60s)
      if (oauthMeta?.refreshToken && credentialStore.isTokenExpired(integrationId)) {
        try {
          const newTokens = await oauthManager.refreshAccessToken(
            record.providerId, oauthMeta.clientId, oauthMeta.clientSecret,
            oauthMeta.refreshToken, oauthMeta.redirectUri
          );
          credentials = oauthManager.mapTokensToCredentials(record.providerId, integrationId, newTokens, {});
          credentialStore.updateOAuthTokens(integrationId, newTokens.access_token, newTokens.refresh_token, newTokens.expires_in);
          log('info', 'CREDS', `Refreshed OAuth token for: ${integrationId}`);
        } catch (refreshErr) {
          log('warn', 'CREDS', `Token refresh failed for ${integrationId}`, { error: refreshErr.message });
          // Continue with old token — it may still work
        }
      }

      // Wait for service to be ready before restoring — retry up to 10s
      let attempts = 0;
      while (!_serviceReady && attempts < 20) {
        await new Promise((r) => setTimeout(r, 500));
        attempts++;
      }
      if (!_serviceReady) {
        log('warn', 'CREDS', `Service not ready, skipping restore for: ${integrationId}`);
        continue;
      }

      await serviceCall('integration-connect', integrationId, credentials);
      log('info', 'CREDS', `Restored: ${integrationId}`);
    } catch (err) {
      log('warn', 'CREDS', `Failed to restore ${integrationId}`, { error: err.message });
    }
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit — keep running in tray
  }
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});

app.on('before-quit', async () => {
  log('info', 'APP', 'Before quit — shutting down service');
  app.isQuitting = true;

  // Tell service to shut down gracefully
  if (_service && _service.connected) {
    try {
      _service.send({ cmd: 'shutdown' });
      // Give it 3s to save DB and clean up
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        _service.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    } catch (_) {}
  }

  // Force kill if still running
  if (_service) {
    try { _service.kill('SIGKILL'); } catch (_) {}
    _service = null;
  }

  // Clean up lock file
  const lockPath = path.join(USER_DATA, 'service.lock');
  try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (_) {}

  // Clean up plugins (local)
  try { await pluginManager.unloadAll(); } catch (err) { log('error', 'PLUGINS', 'Error unloading plugins', { error: err.message }); }
});
