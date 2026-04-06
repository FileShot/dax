// ─── Agent Service ──────────────────────────────────────────
// Standalone background process that owns all agent execution.
// Forked from Electron main process via child_process.fork().
// Survives window close — agents keep running in background.
// Communicates with Electron UI via process.send() / process.on('message').

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const metrics = require('./engine/metrics');

// ─── Paths ──────────────────────────────────────────────────
const USER_DATA = process.env.DAX_USER_DATA || path.join(
  process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'),
  'dax'
);
const DB_PATH = path.join(USER_DATA, 'dax.db');
const LOG_DIR = path.join(USER_DATA, 'logs');
const LOCK_FILE = path.join(USER_DATA, 'service.lock');
const MODELS_DIR = path.join(USER_DATA, 'models');
const PLUGINS_DIR = path.join(USER_DATA, 'plugins');

// Ensure directories exist
for (const dir of [USER_DATA, LOG_DIR, MODELS_DIR, PLUGINS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Logging ────────────────────────────────────────────────
const LOG_FILE = path.join(LOG_DIR, `dax-service-${new Date().toISOString().slice(0, 10)}.log`);
const LOG_MAX_AGE_DAYS = 7;
const LOG_MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

function rotateLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('dax-') && f.endsWith('.log'))
      .map(f => ({ name: f, path: path.join(LOG_DIR, f), stat: fs.statSync(path.join(LOG_DIR, f)) }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    const cutoff = Date.now() - LOG_MAX_AGE_DAYS * 86400000;
    let totalSize = 0;
    for (const f of files) {
      totalSize += f.stat.size;
      if (f.stat.mtimeMs < cutoff || totalSize > LOG_MAX_TOTAL_BYTES) {
        try { fs.unlinkSync(f.path); } catch (_) {}
      }
    }
  } catch (_) {}
}
rotateLogs();

// Batched async log writer — flushes every 200ms instead of sync per-line
let _logBuffer = [];
let _logFlushTimer = null;

function _flushLogs() {
  if (_logBuffer.length === 0) return;
  const batch = _logBuffer.join('');
  _logBuffer = [];
  _logFlushTimer = null;
  fs.appendFile(LOG_FILE, batch, () => {});
}

function _flushLogsSync() {
  if (_logBuffer.length === 0) return;
  try { fs.appendFileSync(LOG_FILE, _logBuffer.join('')); } catch (_) {}
  _logBuffer = [];
  if (_logFlushTimer) { clearTimeout(_logFlushTimer); _logFlushTimer = null; }
}

function log(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}`;
  if (level === 'error') console.error(entry);
  else console.log(entry);

  _logBuffer.push(entry + '\n');
  if (!_logFlushTimer) {
    _logFlushTimer = setTimeout(_flushLogs, 200);
  }

  // Forward logs to parent if connected
  sendToParent('log', { level, category, message, data });
}

// ─── Parent IPC ─────────────────────────────────────────────
function sendToParent(type, payload) {
  if (process.send) {
    try { process.send({ type, ...payload }); } catch (_) {}
  }
}

// ─── Global Error Handlers ──────────────────────────────────
process.on('uncaughtException', (error) => {
  log('error', 'SERVICE', 'Uncaught exception', { message: error.message, stack: error.stack });
});
process.on('unhandledRejection', (reason) => {
  log('error', 'SERVICE', 'Unhandled rejection', {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : String(reason)
  });
});

// ─── Database ───────────────────────────────────────────────
let _db = null;
let _SQL = null;
const BACKUP_DIR = path.join(USER_DATA, 'backups');
const BACKUP_MAX_COUNT = 5;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function backupDb() {
  if (!fs.existsSync(DB_PATH)) return;
  try {
    // Flush any pending writes before backup
    if (_db && _saveTimer) saveDbSync();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(BACKUP_DIR, `dax-${ts}.db`);
    fs.copyFileSync(DB_PATH, dest);
    log('info', 'DB', 'Backup created', { path: dest });

    // Prune old backups
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('dax-') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of backups.slice(BACKUP_MAX_COUNT)) {
      try { fs.unlinkSync(old.path); } catch (_) {}
    }
  } catch (err) {
    log('error', 'DB', 'Backup failed', { error: err.message });
  }
}

// Backup on startup + every 24h
backupDb();
setInterval(backupDb, 24 * 60 * 60 * 1000);

async function initDb() {
  const initSqlJs = require('sql.js');
  _SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(buffer);
    log('info', 'DB', 'Loaded existing database', { size: buffer.length });
  } else {
    _db = new _SQL.Database();
    log('info', 'DB', 'Created new database');
  }
  _db.run('PRAGMA journal_mode = WAL');
  _db.run('PRAGMA foreign_keys = ON');
  initSchema(_db);
  return _db;
}

let _saveTimer = null;
let _saving = false;

function _flushDb() {
  if (!_db) return;
  _saving = true;
  try {
    const data = _db.export();
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, Buffer.from(data));
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    try {
      if (fs.existsSync(`${DB_PATH}.tmp`)) fs.unlinkSync(`${DB_PATH}.tmp`);
    } catch (_) {}
    log('error', 'DB', 'Failed to persist database', { path: DB_PATH, error: err.message });
  } finally {
    _saving = false;
  }
}

function saveDb() {
  // Debounce: coalesce rapid writes into one flush every 500ms
  if (_saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    _flushDb();
  }, 500);
}

// Force immediate save (for shutdown, backup, export)
function saveDbSync() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  _flushDb();
}

function dbAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbGet(db, sql, params = []) {
  const rows = dbAll(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function dbRun(db, sql, params = []) {
  db.run(sql, params);
  saveDb();
}

async function getDb() {
  if (!_db) await initDb();
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      trigger_type TEXT NOT NULL DEFAULT 'manual',
      trigger_config TEXT DEFAULT '{}',
      nodes TEXT DEFAULT '[]',
      edges TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      model_id TEXT DEFAULT '',
      system_prompt TEXT DEFAULT '',
      temperature REAL DEFAULT 0.7,
      max_retries INTEGER DEFAULT 3,
      token_budget INTEGER DEFAULT 4096,
      webhook_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      trigger_data TEXT DEFAULT '{}',
      result TEXT DEFAULT '{}',
      error TEXT,
      tokens_used INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      node_id TEXT,
      level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      data TEXT DEFAULT '{}',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS agent_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      memory_type TEXT NOT NULL DEFAULT 'long_term',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'local',
      model_path TEXT,
      api_key_encrypted TEXT,
      context_size INTEGER DEFAULT 4096,
      gpu_layers INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT DEFAULT '0.0.1',
      description TEXT DEFAULT '',
      entry_point TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config TEXT DEFAULT '{}',
      installed_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS crews (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      agents TEXT DEFAULT '[]',
      strategy TEXT DEFAULT 'sequential',
      max_rounds INTEGER DEFAULT 10,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_run_logs_run ON run_logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);

    CREATE TABLE IF NOT EXISTS knowledge_bases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      model TEXT DEFAULT 'nomic-embed-text',
      chunk_size INTEGER DEFAULT 512,
      overlap INTEGER DEFAULT 50,
      doc_count INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS kb_documents (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT DEFAULT '',
      chunk_count INTEGER DEFAULT 0,
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_kb_docs_kb ON kb_documents(kb_id);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      ts TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_messages(ts);

    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // ─── Versioned Migrations ──────────────────────────────────
  const migrations = [
    { version: 1, name: 'add_webhook_token', up: () => {
      try { db.run("ALTER TABLE agents ADD COLUMN webhook_token TEXT"); } catch (_) {}
    }},
    // Add new migrations here with incrementing version numbers:
    // { version: 2, name: 'add_some_column', up: () => { db.run("ALTER TABLE ..."); }},
  ];

  let currentVersion = 0;
  try {
    const row = dbGet(db, 'SELECT MAX(version) as v FROM _migrations');
    if (row && row.v != null) currentVersion = row.v;
  } catch (_) {}

  for (const m of migrations) {
    if (m.version <= currentVersion) continue;
    try {
      m.up();
      db.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [m.version, m.name]);
      log('info', 'DB', `Migration ${m.version} applied: ${m.name}`);
    } catch (err) {
      log('error', 'DB', `Migration ${m.version} failed: ${m.name}`, { error: err.message });
      throw new Error(`DB migration ${m.version} (${m.name}) failed: ${err.message}`);
    }
  }

  saveDb();
}

// ─── Engine Setup ───────────────────────────────────────────
const { executeAgent, cancelRun, getActiveRuns, events: runnerEvents, toolRegistry } = require('./engine/agent-runner');
const scheduler = require('./engine/scheduler');
const integrationRegistry = require('./engine/integrations/registry');
const { RateLimiter, normalizeError, CircuitBreaker, ErrorBudget } = require('./engine/integration-utils');
const mcpClient = require('./engine/mcp-client');

/** Rate limiter: max 20 actions/sec per integration to avoid hammering downstream APIs */
const _integrationRateLimiter = new RateLimiter();

/** Circuit breaker: opens after 5 consecutive failures, resets after 60s */
const _circuitBreaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000, successThreshold: 2 });

/** Error budget: max 10 errors per 5-minute window per integration */
const _errorBudget = new ErrorBudget({ windowMs: 5 * 60 * 1000, errorLimit: 10 });

/** Run fn with a hard timeout; rejects with a descriptive error if exceeded */
function _withTimeout(fn, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Integration action timed out after ' + ms + 'ms')), ms);
    Promise.resolve().then(fn).then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}
mcpClient.setLogger((msg) => log('info', 'MCP', msg));

// Auto-discover and register all integrations
const _integrationsDir = path.join(__dirname, 'engine', 'integrations');
const _skipFiles = new Set(['registry.js', '_template.js']);
for (const file of fs.readdirSync(_integrationsDir)) {
  if (!file.endsWith('.js') || _skipFiles.has(file)) continue;
  try {
    const mod = require(path.join(_integrationsDir, file));
    if (mod && mod.id) integrationRegistry.register(mod);
  } catch (err) {
    log('warn', 'integration-loader', `Failed to load ${file}: ${err.message}`);
  }
}

// Engine helpers
const engineHelpers = { dbAll, dbGet, dbRun, getDb, log };

// Forward run events to parent + track metrics
runnerEvents.on('run-started', (data) => {
  metrics.increment('runs_started');
  metrics.gauge('active_runs', getActiveRuns().length);
  sendToParent('run-started', data);
});
runnerEvents.on('run-completed', (data) => {
  metrics.increment('runs_completed');
  if (data.status === 'error') metrics.increment('runs_errored');
  if (data.duration_ms) metrics.observe('run_duration_ms', data.duration_ms);
  if (data.tokens_used) metrics.increment('tokens_used', data.tokens_used);
  metrics.gauge('active_runs', getActiveRuns().length);
  sendToParent('run-completed', data);
});
runnerEvents.on('run-step', (data) => {
  metrics.increment('run_steps');
  sendToParent('run-step', data);
});

// ─── Webhook Server ─────────────────────────────────────────
let _webhookServer = null;
const _webhookRateLimit = new Map(); // agentId → { count, resetTime }
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60000;

function startWebhookServer(port = 3700, bindAddress = '127.0.0.1') {
  if (_webhookServer) return;

  _webhookServer = http.createServer(async (req, res) => {
    // No CORS headers — webhooks are server-to-server calls, not browser requests.
    // If a browser origin is needed, configure an explicit allowlist instead of '*'.
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // Health endpoint (no PID — avoids fingerprinting)
    if (url.pathname === '/health' && req.method === 'GET') {
      const mem = process.memoryUsage();
      let dbSizeBytes = 0;
      try { dbSizeBytes = fs.statSync(DB_PATH).size; } catch (_) {}
      let agentCounts = { total: 0, enabled: 0, scheduled: 0 };
      try {
        const db = await getDb();
        agentCounts.total = (dbGet(db, 'SELECT COUNT(*) as c FROM agents') || {}).c || 0;
        agentCounts.enabled = (dbGet(db, 'SELECT COUNT(*) as c FROM agents WHERE enabled = 1') || {}).c || 0;
        agentCounts.scheduled = (dbGet(db, "SELECT COUNT(*) as c FROM agents WHERE enabled = 1 AND trigger_type = 'schedule'") || {}).c || 0;
      } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        agents_running: getActiveRuns().length,
        agents: agentCounts,
        memory: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        db_size_bytes: dbSizeBytes,
      }));
      return;
    }

    // Metrics endpoint — detailed counters, gauges, histograms
    if (url.pathname === '/metrics' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics.getAll()));
      return;
    }

    // Webhook endpoint: POST /webhook/:agentId/:token
    const webhookMatch = url.pathname.match(/^\/webhook\/([^/]+)\/([^/]+)$/);
    if (webhookMatch && req.method === 'POST') {
      metrics.increment('webhook_requests');
      const [, agentId, token] = webhookMatch;

      // Rate limiting
      const now = Date.now();
      let rateEntry = _webhookRateLimit.get(agentId);
      if (!rateEntry || now > rateEntry.resetTime) {
        rateEntry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
        _webhookRateLimit.set(agentId, rateEntry);
      }
      rateEntry.count++;
      if (rateEntry.count > RATE_LIMIT_MAX) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded', retry_after_ms: rateEntry.resetTime - now }));
        return;
      }

      // Read body (max 1MB)
      let body = '';
      let bodySize = 0;
      const MAX_BODY = 1024 * 1024;

      try {
        await new Promise((resolve, reject) => {
          req.on('data', (chunk) => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY) { req.destroy(); reject(new Error('Request body too large')); return; }
            body += chunk;
          });
          req.on('end', resolve);
          req.on('error', reject);
        });
      } catch (err) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return;
      }

      // Validate agent and token
      try {
        const db = await getDb();
        const agent = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [agentId]);
        if (!agent || agent.trigger_type !== 'webhook') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Agent not found or not webhook-enabled' }));
          return;
        }
        if (!agent.webhook_token || agent.webhook_token !== token) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid webhook token' }));
          return;
        }
        if (!agent.enabled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Agent is disabled' }));
          return;
        }

        // Parse body
        let parsedBody = {};
        if (body) {
          try { parsedBody = JSON.parse(body); } catch (_) { parsedBody = { raw: body }; }
        }

        // Execute agent
        const triggerData = {
          trigger: 'webhook',
          method: req.method,
          headers: req.headers,
          body: parsedBody,
          query: Object.fromEntries(url.searchParams),
          ip: req.socket.remoteAddress,
        };

        log('info', 'WEBHOOK', `Triggered: ${agent.name}`, { agentId, ip: triggerData.ip });

        const result = await executeAgent(agent, triggerData, engineHelpers);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          run_id: result.runId,
          status: result.status,
          result: result.result,
          tokens: result.tokens,
        }));
      } catch (err) {
        log('error', 'WEBHOOK', 'Execution failed', { error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // 404 for everything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  _webhookServer.listen(port, bindAddress, () => {
    log('info', 'WEBHOOK', `Server listening on ${bindAddress}:${port}`);
    sendToParent('webhook-ready', { port, bindAddress });
  });

  _webhookServer.on('error', (err) => {
    log('error', 'WEBHOOK', `Server error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      log('warn', 'WEBHOOK', `Port ${port} in use, trying ${port + 1}`);
      setTimeout(() => startWebhookServer(port + 1, bindAddress), 1000);
    }
  });
}

function stopWebhookServer() {
  if (_webhookServer) {
    _webhookServer.close();
    _webhookServer = null;
    log('info', 'WEBHOOK', 'Server stopped');
  }
}

// ─── Heartbeat ──────────────────────────────────────────────
let _heartbeatInterval = null;

function startHeartbeat() {
  _heartbeatInterval = setInterval(() => {
    const mem = process.memoryUsage();
    metrics.gauge('memory_rss', mem.rss);
    metrics.gauge('memory_heap_used', mem.heapUsed);
    metrics.gauge('active_runs', getActiveRuns().length);
    sendToParent('heartbeat', {
      pid: process.pid,
      uptime: process.uptime(),
      memory: mem.heapUsed,
      activeRuns: getActiveRuns().length,
      schedulerStatus: scheduler.getStatus(),
    });
  }, 30000);
}

// ─── Lock File ──────────────────────────────────────────────
function writeLockFile(port) {
  const lock = {
    pid: process.pid,
    port: port,
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2));
}

function removeLockFile() {
  try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

// ─── Message Handler ────────────────────────────────────────
// Receives commands from Electron main process and responds

async function handleMessage(msg) {
  // Handle shutdown signal (no id/cmd structure)
  if (msg.cmd === 'shutdown') {
    shutdown();
    return;
  }

  const { id, cmd, args } = msg;
  const _ipcStart = Date.now();
  let result = null;
  let error = null;

  metrics.increment('ipc_calls');
  metrics.increment(`ipc.${cmd}`);

  try {
    switch (cmd) {
      // ─── Agents ──────────────────────
      case 'agents-list': {
        const db = await getDb();
        result = dbAll(db, 'SELECT * FROM agents ORDER BY created_at DESC');
        break;
      }
      case 'agents-get': {
        const db = await getDb();
        result = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [args[0]]);
        break;
      }
      case 'agents-create': {
        const db = await getDb();
        const agent = args[0];
        const agentId = agent.id || crypto.randomUUID();
        dbRun(db, `
          INSERT INTO agents (id, name, description, trigger_type, trigger_config, nodes, edges, enabled, model_id, system_prompt, temperature, max_retries, token_budget)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          agentId, agent.name, agent.description || '', agent.trigger_type || 'manual',
          JSON.stringify(agent.trigger_config || {}), JSON.stringify(agent.nodes || []),
          JSON.stringify(agent.edges || []), agent.enabled !== false ? 1 : 0,
          agent.model_id || '', agent.system_prompt || '', agent.temperature || 0.7,
          agent.max_retries || 3, agent.token_budget || 4096
        ]);
        result = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [agentId]);
        // Auto-schedule if it's a scheduled agent
        if (result && result.enabled && result.trigger_type === 'schedule') {
          scheduler.scheduleAgent(result);
        }
        break;
      }
      case 'agents-update': {
        const db = await getDb();
        const [updateId, updates] = args;
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
          if (['name', 'description', 'trigger_type', 'model_id', 'system_prompt'].includes(key)) {
            fields.push(`${key} = ?`); values.push(value);
          } else if (['trigger_config', 'nodes', 'edges'].includes(key)) {
            fields.push(`${key} = ?`); values.push(JSON.stringify(value));
          } else if (['enabled'].includes(key)) {
            fields.push(`${key} = ?`); values.push(value ? 1 : 0);
          } else if (['temperature', 'max_retries', 'token_budget'].includes(key)) {
            fields.push(`${key} = ?`); values.push(value);
          }
        }
        if (fields.length > 0) {
          fields.push("updated_at = datetime('now')");
          values.push(updateId);
          dbRun(db, `UPDATE agents SET ${fields.join(', ')} WHERE id = ?`, values);
        }
        result = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [updateId]);
        // Re-evaluate scheduling after update
        if (result && result.enabled && result.trigger_type === 'schedule') {
          scheduler.scheduleAgent(result);
        } else if (result) {
          scheduler.unscheduleAgent(updateId);
        }
        break;
      }
      case 'agents-delete': {
        const db = await getDb();
        dbRun(db, 'DELETE FROM agents WHERE id = ?', [args[0]]);
        scheduler.unscheduleAgent(args[0]);
        result = { success: true };
        break;
      }
      case 'agents-toggle': {
        const db = await getDb();
        dbRun(db, "UPDATE agents SET enabled = NOT enabled, updated_at = datetime('now') WHERE id = ?", [args[0]]);
        result = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [args[0]]);
        log('info', 'SERVICE', `Toggle agent: ${args[0]}`, { enabled: result?.enabled, name: result?.name });
        // Re-evaluate scheduling
        if (result && result.enabled) {
          scheduler.scheduleAgent(result);
        } else {
          scheduler.unscheduleAgent(args[0]);
        }
        break;
      }

      // ─── Runs ────────────────────────
      case 'runs-list': {
        const db = await getDb();
        const [agentId, limit] = args;
        if (agentId) {
          result = dbAll(db, 'SELECT * FROM runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?', [agentId, limit || 50]);
        } else {
          result = dbAll(db, 'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?', [limit || 50]);
        }
        break;
      }
      case 'runs-get': {
        const db = await getDb();
        const run = dbGet(db, 'SELECT * FROM runs WHERE id = ?', [args[0]]);
        if (run) run.logs = dbAll(db, 'SELECT * FROM run_logs WHERE run_id = ? ORDER BY timestamp ASC', [args[0]]);
        result = run;
        break;
      }

      // ─── Execution ──────────────────
      case 'agent-run': {
        const db = await getDb();
        const [runAgentId, triggerData] = args;
        const agent = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [runAgentId]);
        if (!agent) throw new Error(`Agent not found: ${runAgentId}`);
        result = await executeAgent(agent, triggerData || { trigger: 'manual' }, engineHelpers);
        break;
      }
      case 'agent-cancel-run': {
        result = { cancelled: cancelRun(args[0]) };
        break;
      }
      case 'agent-active-runs': {
        result = getActiveRuns();
        break;
      }
      case 'tools-list': {
        result = toolRegistry.list();
        break;
      }
      case 'scheduler-status': {
        result = scheduler.getStatus();
        break;
      }
      case 'output-files-list': {
        const _fs = require('fs');
        const _path = require('path');
        const outputDir = _path.join(process.cwd(), 'test-output');
        try {
          if (!_fs.existsSync(outputDir)) { result = []; break; }
          const entries = _fs.readdirSync(outputDir, { withFileTypes: true });
          result = entries
            .filter(e => e.isFile())
            .map(e => {
              const stat = _fs.statSync(_path.join(outputDir, e.name));
              return { name: e.name, size: stat.size, modified: stat.mtime.toISOString() };
            })
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));
        } catch (err) { result = []; }
        break;
      }
      case 'output-files-read': {
        const _fs2 = require('fs');
        const _path2 = require('path');
        const [fileName] = args;
        const outputDir2 = _path2.join(process.cwd(), 'test-output');
        const filePath = _path2.join(outputDir2, _path2.basename(String(fileName)));
        // Prevent path traversal
        if (!filePath.startsWith(outputDir2)) { result = { error: 'Invalid path' }; break; }
        try {
          const content = _fs2.readFileSync(filePath, 'utf-8');
          result = { name: fileName, content, size: Buffer.byteLength(content) };
        } catch (err) { result = { error: err.message }; }
        break;
      }
      case 'chat-message': {
        // Ephemeral LLM chat — no DB record, supports token streaming
        const { createClient: _createClient } = require('./engine/llm-client');
        const [chatArgs] = args;
        const { messages: chatMessages, model: chatModelId, system: chatSystem } = chatArgs || {};

        // Resolve model config: use provided model ID → fallback to first model in DB → fallback to Ollama
        const db = await getDb();
        let _llmCfg = { baseUrl: 'http://localhost:11434/v1', defaultModel: '' };
        const _rawModelId = chatModelId || null;
        if (_rawModelId) {
          const _m = dbGet(db, 'SELECT * FROM models WHERE id = ? OR name = ?', [_rawModelId, _rawModelId]);
          if (_m) {
            _llmCfg = { baseUrl: _m.model_path || _llmCfg.baseUrl, apiKey: _m.api_key_encrypted || '', defaultModel: _m.name };
          }
        } else {
          const _first = dbGet(db, 'SELECT * FROM models ORDER BY created_at ASC LIMIT 1');
          if (_first) {
            _llmCfg = { baseUrl: _first.model_path || _llmCfg.baseUrl, apiKey: _first.api_key_encrypted || '', defaultModel: _first.name };
          }
        }

        const _llm = _createClient(_llmCfg);
        const _builtMessages = [];
        if (chatSystem) _builtMessages.push({ role: 'system', content: chatSystem });
        if (Array.isArray(chatMessages)) _builtMessages.push(...chatMessages);

        const _streamResult = await _llm.chatCompletionStream({
          messages: _builtMessages,
          onToken: (token) => sendToParent('llm-token', { token }),
        });
        result = { content: _streamResult.content, usage: _streamResult.usage };
        break;
      }

      // ─── Chat History ──────────────────
      case 'chat-history-list': {
        const db = await getDb();
        const limit = args[0] || 200;
        result = dbAll(db, 'SELECT * FROM chat_messages ORDER BY ts ASC LIMIT ?', [limit]);
        break;
      }
      case 'chat-history-save': {
        const db = await getDb();
        const msg = args[0];
        if (!msg || !msg.role || !msg.content) { result = { error: 'Invalid message' }; break; }
        const msgId = msg.id || crypto.randomUUID();
        dbRun(db, 'INSERT OR REPLACE INTO chat_messages (id, role, content, ts) VALUES (?, ?, ?, ?)',
          [String(msgId), msg.role, msg.content, msg.ts || new Date().toISOString()]);
        result = { id: msgId };
        break;
      }
      case 'chat-history-clear': {
        const db = await getDb();
        dbRun(db, 'DELETE FROM chat_messages');
        result = { success: true };
        break;
      }

      // ─── Models ─────────────────────
      case 'models-list': {
        const db = await getDb();
        result = dbAll(db, 'SELECT * FROM models ORDER BY name ASC');
        break;
      }
      case 'models-scan-local': {
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
        result = files;
        break;
      }
      case 'models-add': {
        const db = await getDb();
        const model = args[0];
        const modelId = model.id || crypto.randomUUID();
        dbRun(db, `INSERT OR REPLACE INTO models (id, name, provider, model_path, context_size, gpu_layers) VALUES (?, ?, ?, ?, ?, ?)`,
          [modelId, model.name, model.provider || 'local', model.model_path || '', model.context_size || 4096, model.gpu_layers || 0]);
        result = dbGet(db, 'SELECT * FROM models WHERE id = ?', [modelId]);
        break;
      }
      case 'models-delete': {
        const db = await getDb();
        dbRun(db, 'DELETE FROM models WHERE id = ?', [args[0]]);
        result = { success: true };
        break;
      }

      case 'models-search-hf': {
        // Search HuggingFace for GGUF models
        const { query: hfQuery, limit: hfLimit } = args[0] || {};
        const searchQ = encodeURIComponent(hfQuery || 'gguf');
        const maxResults = Math.min(hfLimit || 20, 50);
        const hfUrl = `https://huggingface.co/api/models?search=${searchQ}&filter=gguf&sort=downloads&direction=-1&limit=${maxResults}&expand[]=siblings&expand[]=likes&expand[]=tags&expand[]=lastModified`;

        const hfFetch = (url) => new Promise((resolve, reject) => {
          const hfReq = require('https').get(url, { headers: { 'User-Agent': 'Dax/1.0' } }, (res) => {
            // Follow redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              hfFetch(res.headers.location).then(resolve).catch(reject);
              return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
              catch { resolve([]); }
            });
          });
          hfReq.on('error', reject);
          hfReq.setTimeout(15000, () => { hfReq.destroy(); reject(new Error('HuggingFace API timeout')); });
        });

        const hfData = await hfFetch(hfUrl);

        // For each model, extract GGUF download links from siblings
        const hfResults = [];
        for (const m of (Array.isArray(hfData) ? hfData : [])) {
          const repoId = m.id || m.modelId || m._id;
          const ggufFiles = (m.siblings || [])
            .filter(s => s.rfilename && s.rfilename.toLowerCase().endsWith('.gguf'))
            .map(s => ({
              filename: s.rfilename,
              url: `https://huggingface.co/${repoId}/resolve/main/${encodeURIComponent(s.rfilename)}`,
              size: s.size || null,
            }));

          const tags = m.tags || [];
          const pipeline = tags.find(t => t === 'text-generation' || t === 'text2text-generation' || t === 'feature-extraction') || '';

          hfResults.push({
            id: repoId,
            name: repoId?.split('/').pop() || repoId,
            author: repoId?.split('/')[0] || '',
            downloads: m.downloads || 0,
            likes: m.likes || 0,
            tags: tags.filter(t => !t.startsWith('base_model:') && !t.startsWith('region:') && t !== 'endpoints_compatible').slice(0, 10),
            lastModified: m.lastModified,
            pipeline,
            files: ggufFiles,
          });
        }
        result = hfResults;
        break;
      }

      case 'models-download': {
        // Download a GGUF file from URL to models directory
        const { url: dlUrl, filename: dlFilename } = args[0] || {};
        if (!dlUrl || !dlFilename) throw new Error('url and filename required');

        // Validate URL is from huggingface.co
        const parsedDlUrl = new URL(dlUrl);
        if (!parsedDlUrl.hostname.endsWith('huggingface.co')) {
          throw new Error('Downloads restricted to huggingface.co');
        }

        // Sanitize filename
        const safeName = path.basename(dlFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
        if (!safeName.toLowerCase().endsWith('.gguf')) throw new Error('Only .gguf files can be downloaded');

        const destPath = path.join(MODELS_DIR, safeName);
        if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

        // Stream download with progress
        const dlModule = parsedDlUrl.protocol === 'https:' ? require('https') : require('http');
        await new Promise((resolve, reject) => {
          const follow = (url, redirects = 0) => {
            if (redirects > 5) { reject(new Error('Too many redirects')); return; }
            const u = new URL(url);
            const client = u.protocol === 'https:' ? require('https') : require('http');
            client.get(url, { headers: { 'User-Agent': 'Dax/1.0' } }, (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                follow(res.headers.location, redirects + 1);
                return;
              }
              if (res.statusCode !== 200) {
                reject(new Error(`Download failed: HTTP ${res.statusCode}`));
                return;
              }
              const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
              let downloaded = 0;
              const ws = fs.createWriteStream(destPath);
              let lastProgress = 0;
              res.on('data', (chunk) => {
                downloaded += chunk.length;
                ws.write(chunk);
                const pct = totalBytes > 0 ? Math.floor((downloaded / totalBytes) * 100) : 0;
                if (pct >= lastProgress + 2) { // Emit every 2%
                  lastProgress = pct;
                  sendToParent('model-download-progress', { filename: safeName, downloaded, total: totalBytes, percent: pct });
                }
              });
              res.on('end', () => { ws.end(); resolve(); });
              res.on('error', (err) => { ws.destroy(); reject(err); });
            }).on('error', reject);
          };
          follow(dlUrl);
        });
        sendToParent('model-download-progress', { filename: safeName, downloaded: -1, total: -1, percent: 100, done: true });
        result = { success: true, path: destPath, filename: safeName };
        break;
      }

      // ─── Settings ───────────────────
      case 'settings-get': {
        const db = await getDb();
        const row = dbGet(db, 'SELECT value FROM settings WHERE key = ?', [args[0]]);
        if (!row) { result = null; break; }
        try { result = JSON.parse(row.value); } catch { result = row.value; }
        break;
      }
      case 'settings-set': {
        const db = await getDb();
        const serialized = typeof args[1] === 'string' ? args[1] : JSON.stringify(args[1]);
        dbRun(db, 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [args[0], serialized]);
        result = { success: true };
        break;
      }
      case 'settings-all': {
        const db = await getDb();
        const rows = dbAll(db, 'SELECT * FROM settings');
        result = {};
        for (const row of rows) {
          try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
        }
        break;
      }

      // ─── Integrations ───────────────
      case 'integrations-list': {
        result = integrationRegistry.list();
        break;
      }
      case 'integration-connect': {
        const integration = integrationRegistry.get(args[0]);
        if (!integration) throw new Error(`Integration not found: ${args[0]}`);
        await integration.connect(args[1]);
        integrationRegistry.registerWithToolRegistry(toolRegistry);
        result = { success: true };
        break;
      }
      case 'integration-disconnect': {
        const integration = integrationRegistry.get(args[0]);
        if (!integration) throw new Error(`Integration not found: ${args[0]}`);
        await integration.disconnect();
        result = { success: true };
        break;
      }
      case 'integration-test': {
        const integration = integrationRegistry.get(args[0]);
        if (!integration) throw new Error(`Integration not found: ${args[0]}`);
        result = await integration.test(args[1] || integration.credentials);
        break;
      }
      case 'circuit-status': {
        result = _circuitBreaker.allStatuses();
        break;
      }
      case 'error-budget-status': {
        result = args[0] ? _errorBudget.status(args[0]) : _errorBudget.allStatuses();
        break;
      }
      case 'integration-action': {
        const integration = integrationRegistry.get(args[0]);
        if (!integration) throw new Error('Integration not found: ' + args[0]);
        if (!integration.connected) throw new Error('Integration "' + integration.name + '" is not connected');
        const integId = args[0];
        if (!_circuitBreaker.isAllowed(integId)) {
          result = normalizeError(new Error('Circuit open: "' + integId + '" is suspended after repeated failures'), { integration: integId, action: args[1] });
          result.circuit = 'open';
          break;
        }
        await _integrationRateLimiter.throttle(integId);
        try {
          result = await _withTimeout(() => integration.executeAction(args[1], args[2]), 30000);
          _circuitBreaker.onSuccess(integId);
          _errorBudget.record(integId, false);
        } catch (err) {
          _circuitBreaker.onFailure(integId);
          _errorBudget.record(integId, true);
          result = normalizeError(err, { integration: integId, action: args[1] });
          const budget = _errorBudget.status(integId);
          result.errorBudget = budget;
          if (budget.exhausted) result.message += ' [error budget exhausted]';
        }
        break;
      }

      // ─── Webhooks ───────────────────
      case 'webhook-generate-token': {
        const db = await getDb();
        const newToken = crypto.randomUUID();
        dbRun(db, 'UPDATE agents SET webhook_token = ? WHERE id = ?', [newToken, args[0]]);
        result = { token: newToken };
        break;
      }
      case 'webhook-get-info': {
        const db = await getDb();
        const agent = dbGet(db, 'SELECT id, webhook_token FROM agents WHERE id = ?', [args[0]]);
        const webhookPort = _webhookServer?.address()?.port || 3700;
        result = {
          token: agent?.webhook_token || null,
          url: agent?.webhook_token ? `http://localhost:${webhookPort}/webhook/${args[0]}/${agent.webhook_token}` : null,
          port: webhookPort,
        };
        break;
      }

      // ─── Crews ──────────────────────
      case 'crews-list': {
        const db = await getDb();
        result = dbAll(db, 'SELECT * FROM crews ORDER BY created_at DESC');
        break;
      }
      case 'crews-get': {
        const db = await getDb();
        result = dbGet(db, 'SELECT * FROM crews WHERE id = ?', [args[0]]);
        break;
      }
      case 'crews-create': {
        const db = await getDb();
        const crew = args[0];
        const crewId = crew.id || crypto.randomUUID();
        dbRun(db, `INSERT INTO crews (id, name, description, agents, strategy, max_rounds) VALUES (?, ?, ?, ?, ?, ?)`,
          [crewId, crew.name, crew.description || '', JSON.stringify(crew.agents || []),
           crew.strategy || 'sequential', crew.max_rounds || 10]);
        result = dbGet(db, 'SELECT * FROM crews WHERE id = ?', [crewId]);
        break;
      }
      case 'crews-update': {
        const db = await getDb();
        const [crewId, crewUpdates] = args;
        const cFields = [];
        const cValues = [];
        for (const [key, value] of Object.entries(crewUpdates)) {
          if (['name', 'description', 'strategy'].includes(key)) {
            cFields.push(`${key} = ?`); cValues.push(value);
          } else if (key === 'agents') {
            cFields.push(`agents = ?`); cValues.push(JSON.stringify(value));
          } else if (key === 'max_rounds') {
            cFields.push(`max_rounds = ?`); cValues.push(value);
          }
        }
        if (cFields.length > 0) {
          cFields.push("updated_at = datetime('now')");
          cValues.push(crewId);
          dbRun(db, `UPDATE crews SET ${cFields.join(', ')} WHERE id = ?`, cValues);
        }
        result = dbGet(db, 'SELECT * FROM crews WHERE id = ?', [crewId]);
        break;
      }
      case 'crews-delete': {
        const db = await getDb();
        dbRun(db, 'DELETE FROM crews WHERE id = ?', [args[0]]);
        result = { success: true };
        break;
      }
      case 'crews-run': {
        const db = await getDb();
        const crew = dbGet(db, 'SELECT * FROM crews WHERE id = ?', [args[0]]);
        if (!crew) throw new Error(`Crew not found: ${args[0]}`);
        const { executeCrew } = require('./engine/crew-engine');
        result = await executeCrew(crew, args[1] || { trigger: 'manual' }, engineHelpers);
        break;
      }

      // ─── Knowledge Base / RAG ──────────
      case 'kb-list': {
        const db = await getDb();
        result = dbAll(db, 'SELECT * FROM knowledge_bases ORDER BY created_at DESC');
        break;
      }
      case 'kb-get': {
        const db = await getDb();
        const kb = dbGet(db, 'SELECT * FROM knowledge_bases WHERE id = ?', [args[0]]);
        if (!kb) throw new Error(`Knowledge base not found: ${args[0]}`);
        const docs = dbAll(db, 'SELECT * FROM kb_documents WHERE kb_id = ? ORDER BY created_at DESC', [args[0]]);
        result = { ...kb, documents: docs };
        break;
      }
      case 'kb-create': {
        const db = await getDb();
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const { name, description, model, chunk_size, overlap } = args[0];
        dbRun(db, `INSERT INTO knowledge_bases (id, name, description, model, chunk_size, overlap) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, name || 'Untitled', description || '', model || 'nomic-embed-text', chunk_size || 512, overlap || 50]);
        result = dbGet(db, 'SELECT * FROM knowledge_bases WHERE id = ?', [id]);
        break;
      }
      case 'kb-delete': {
        const db = await getDb();
        const kb = require('./engine/rag/knowledge-base');
        await kb.deleteKB(args[0]);
        dbRun(db, 'DELETE FROM kb_documents WHERE kb_id = ?', [args[0]]);
        dbRun(db, 'DELETE FROM knowledge_bases WHERE id = ?', [args[0]]);
        result = { success: true };
        break;
      }
      case 'kb-ingest': {
        const db = await getDb();
        const kb = require('./engine/rag/knowledge-base');
        const { kb_id, file_path, text, metadata } = args[0];
        const kbRow = dbGet(db, 'SELECT * FROM knowledge_bases WHERE id = ?', [kb_id]);
        if (!kbRow) throw new Error(`Knowledge base not found: ${kb_id}`);

        let ingestResult;
        if (file_path) {
          ingestResult = await kb.ingestFile({
            kbId: kb_id, filePath: file_path,
            model: kbRow.model, chunkSize: kbRow.chunk_size, overlap: kbRow.overlap,
          });
          // Record document
          const { v4: uuidv4 } = require('uuid');
          const fsStat = fs.statSync(file_path);
          dbRun(db, `INSERT INTO kb_documents (id, kb_id, filename, filepath, chunk_count, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`,
            [ingestResult.doc_id, kb_id, ingestResult.filename, file_path, ingestResult.chunks, fsStat.size]);
        } else if (text) {
          ingestResult = await kb.ingestText({
            kbId: kb_id, text, metadata,
            model: kbRow.model, chunkSize: kbRow.chunk_size, overlap: kbRow.overlap,
          });
          dbRun(db, `INSERT INTO kb_documents (id, kb_id, filename, filepath, chunk_count, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`,
            [ingestResult.doc_id, kb_id, metadata?.filename || 'text-input', '', ingestResult.chunks, Buffer.byteLength(text)]);
        } else {
          throw new Error('kb-ingest: file_path or text required');
        }

        // Update counts
        const totalDocs = dbAll(db, 'SELECT COUNT(*) as c FROM kb_documents WHERE kb_id = ?', [kb_id]);
        const totalChunks = dbAll(db, 'SELECT SUM(chunk_count) as c FROM kb_documents WHERE kb_id = ?', [kb_id]);
        dbRun(db, 'UPDATE knowledge_bases SET doc_count = ?, chunk_count = ?, updated_at = datetime("now") WHERE id = ?',
          [totalDocs[0]?.c || 0, totalChunks[0]?.c || 0, kb_id]);

        result = ingestResult;
        break;
      }
      case 'kb-query': {
        const kb = require('./engine/rag/knowledge-base');
        const { kb_id, question, top_k } = args[0];
        result = await kb.query({ kbId: kb_id, question, topK: top_k || 5 });
        break;
      }
      case 'kb-delete-doc': {
        const db = await getDb();
        const kb = require('./engine/rag/knowledge-base');
        const { kb_id, doc_id } = args[0];
        await kb.deleteDocument(kb_id, doc_id);
        dbRun(db, 'DELETE FROM kb_documents WHERE id = ?', [doc_id]);
        // Update counts
        const totalDocs = dbAll(db, 'SELECT COUNT(*) as c FROM kb_documents WHERE kb_id = ?', [kb_id]);
        const totalChunks = dbAll(db, 'SELECT SUM(chunk_count) as c FROM kb_documents WHERE kb_id = ?', [kb_id]);
        dbRun(db, 'UPDATE knowledge_bases SET doc_count = ?, chunk_count = ?, updated_at = datetime("now") WHERE id = ?',
          [totalDocs[0]?.c || 0, totalChunks[0]?.c || 0, kb_id]);
        result = { success: true };
        break;
      }
      case 'kb-ensure-model': {
        const kb = require('./engine/rag/knowledge-base');
        result = await kb.ensureModel(args[0]);
        break;
      }

      // ─── System ─────────────────────
      case 'system-info': {
        const os = require('os');
        result = {
          platform: process.platform, arch: process.arch,
          cpus: os.cpus().length, totalMemory: os.totalmem(), freeMemory: os.freemem(),
          nodeVersion: process.versions.node, userDataPath: USER_DATA,
          modelsDir: MODELS_DIR, dbPath: DB_PATH,
        };
        break;
      }
      case 'get-models-dir': { result = MODELS_DIR; break; }
      case 'get-user-data': { result = USER_DATA; break; }
      case 'get-log-path': { result = LOG_FILE; break; }
      case 'get-recent-logs': {
        try {
          if (!fs.existsSync(LOG_FILE)) { result = []; break; }
          const content = fs.readFileSync(LOG_FILE, 'utf-8');
          result = content.split('\n').filter(Boolean).slice(-(args[0] || 100));
        } catch { result = []; }
        break;
      }

      // ─── MCP Client ──────────────────
      case 'mcp-add-server': {
        result = await mcpClient.addServer(args[0]);
        mcpClient.registerWithToolRegistry(toolRegistry);
        break;
      }
      case 'mcp-remove-server': {
        mcpClient.removeServer(args[0]);
        result = { success: true };
        break;
      }
      case 'mcp-list-servers': {
        result = mcpClient.getServers();
        break;
      }
      case 'mcp-server-tools': {
        const servers = mcpClient.getServers();
        const server = servers.find((s) => s.id === args[0]);
        result = server ? server.tools : [];
        break;
      }
      case 'mcp-call-tool': {
        result = await mcpClient.callTool(args[0], null, args[1]);
        break;
      }

      // ─── Metrics ─────────────────────
      case 'get-metrics': {
        const mem = process.memoryUsage();
        let dbSizeBytes = 0;
        try { dbSizeBytes = fs.statSync(DB_PATH).size; } catch (_) {}
        metrics.gauge('memory_rss', mem.rss);
        metrics.gauge('memory_heap_used', mem.heapUsed);
        metrics.gauge('db_size_bytes', dbSizeBytes);
        metrics.gauge('active_runs', getActiveRuns().length);
        result = metrics.getAll();
        break;
      }

      default:
        error = `Unknown command: ${cmd}`;
    }
  } catch (err) {
    error = err.message;
    metrics.increment('ipc_errors');
    log('error', 'SERVICE', `Command failed: ${cmd}`, { error: err.message });
  }

  // Track IPC timing
  metrics.observe('ipc_duration_ms', Date.now() - _ipcStart);

  // Send response back to parent
  if (id) {
    sendToParent('response', { id, result, error });
  }
}

// ─── Startup ────────────────────────────────────────────────
async function start() {
  log('info', 'SERVICE', 'Agent service starting', { pid: process.pid, userData: USER_DATA });

  // Initialize database
  await initDb();
  log('info', 'SERVICE', 'Database initialized');

  // Initialize scheduler
  scheduler.init(engineHelpers);
  await scheduler.startAll();
  log('info', 'SERVICE', 'Scheduler started');

  // Read webhook port from settings
  const db = await getDb();
  let webhookPort = 3700;
  let webhookBind = '127.0.0.1';
  const portSetting = dbGet(db, "SELECT value FROM settings WHERE key = 'webhook_port'");
  if (portSetting) try { webhookPort = parseInt(JSON.parse(portSetting.value)); } catch {}
  const bindSetting = dbGet(db, "SELECT value FROM settings WHERE key = 'webhook_bind'");
  if (bindSetting) try { webhookBind = JSON.parse(bindSetting.value); } catch {}

  // Start webhook server
  startWebhookServer(webhookPort, webhookBind);

  // Write lock file
  writeLockFile(webhookPort);

  // Start heartbeat
  startHeartbeat();

  // Listen for messages from parent
  process.on('message', handleMessage);

  log('info', 'SERVICE', 'Agent service ready');
  sendToParent('service-ready', { pid: process.pid, webhookPort });
}

// ─── Shutdown ───────────────────────────────────────────────
function shutdown() {
  log('info', 'SERVICE', 'Shutting down...');
  scheduler.stopAll();
  try { mcpClient.disconnectAll(); } catch (_) {}
  stopWebhookServer();
  removeLockFile();
  if (_heartbeatInterval) clearInterval(_heartbeatInterval);
  if (_db) { try { saveDbSync(); _db.close(); } catch (_) {} }
  log('info', 'SERVICE', 'Shutdown complete');
  _flushLogsSync();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('disconnect', () => {
  // Parent disconnected — keep running as orphan daemon
  log('info', 'SERVICE', 'Parent disconnected — continuing as background service');
});

// Start
start().catch((err) => {
  log('error', 'SERVICE', 'Failed to start', { error: err.message, stack: err.stack });
  process.exit(1);
});
