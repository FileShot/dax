// ─── Dax WebSocket Client ───────────────────────────────────
// When running in a browser (not Electron), this provides a real
// WebSocket-backed window.dax API that bridges to the web-server.js
// backend, replacing the dev-mock.
//
// Protocol:
//   Client sends:  { type: 'invoke', id, channel, args }
//   Server sends:  { type: 'response', id, result?, error? }
//   Server pushes: { type: 'event', event, data }

const _pendingInvokes = new Map();
let _ws = null;
let _wsReady = false;
let _reconnectTimer = null;
const _eventListeners = new Map(); // event → Set<callback>
let _invokeId = 0;

function _connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/ws`;

  _ws = new WebSocket(url);

  _ws.onopen = () => {
    _wsReady = true;
    console.log('[DAX-WS] Connected to', url);
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
  };

  _ws.onclose = () => {
    _wsReady = false;
    console.log('[DAX-WS] Disconnected — reconnecting in 2s');
    // Reject all pending invokes
    for (const [, pending] of _pendingInvokes) {
      pending.reject(new Error('WebSocket disconnected'));
    }
    _pendingInvokes.clear();
    _reconnectTimer = setTimeout(_connect, 2000);
  };

  _ws.onerror = (err) => {
    console.error('[DAX-WS] Error:', err);
  };

  _ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (_) {
      return;
    }

    if (msg.type === 'response' && msg.id && _pendingInvokes.has(msg.id)) {
      const pending = _pendingInvokes.get(msg.id);
      _pendingInvokes.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.result);
      }
    } else if (msg.type === 'event') {
      const listeners = _eventListeners.get(msg.event);
      if (listeners) {
        for (const cb of listeners) {
          try { cb(msg.data); } catch (_) {}
        }
      }
    }
  };
}

function _invoke(channel, ...args) {
  return new Promise((resolve, reject) => {
    if (!_ws || !_wsReady) {
      return reject(new Error('WebSocket not connected'));
    }
    const id = `inv-${++_invokeId}-${Date.now()}`;
    const timeout = setTimeout(() => {
      _pendingInvokes.delete(id);
      reject(new Error(`Invoke timed out: ${channel}`));
    }, 120000);
    _pendingInvokes.set(id, {
      resolve: (result) => { clearTimeout(timeout); resolve(result); },
      reject:  (err) => { clearTimeout(timeout); reject(err); },
    });
    _ws.send(JSON.stringify({ type: 'invoke', id, channel, args }));
  });
}

function _on(eventName, callback) {
  if (!_eventListeners.has(eventName)) {
    _eventListeners.set(eventName, new Set());
  }
  _eventListeners.get(eventName).add(callback);
  return () => {
    const set = _eventListeners.get(eventName);
    if (set) set.delete(callback);
  };
}

// ─── Build window.dax API ───────────────────────────────────
// Mirrors the exact shape from preload.js so the renderer code
// works identically in Electron and browser modes.

export function initWebSocketBridge() {
  if (window.__electronPreload) {
    // Running inside Electron — preload already injected window.dax
    console.log('[DAX-WS] Electron detected, skipping WebSocket bridge');
    return;
  }

  console.log('[DAX-WS] Initializing WebSocket bridge');
  _connect();

  window.dax = {
    platform: navigator.platform.includes('Win') ? 'win32' : navigator.platform.includes('Mac') ? 'darwin' : 'linux',
    versions: { electron: 'web', node: 'web', chrome: navigator.userAgent },

    window: {
      minimize:    () => _invoke('win-minimize'),
      maximize:    () => _invoke('win-maximize'),
      close:       () => _invoke('win-close'),
      isMaximized: () => _invoke('win-is-maximized'),
    },

    openFolder:   () => _invoke('dialog-open-folder'),
    openFile:     (filters) => _invoke('dialog-open-file', filters),
    openExternal: (url) => { window.open(url, '_blank'); return Promise.resolve(); },

    agents: {
      list:    () => _invoke('agents-list'),
      get:     (id) => _invoke('agents-get', id),
      create:  (agent) => _invoke('agents-create', agent),
      update:  (id, updates) => _invoke('agents-update', id, updates),
      delete:  (id) => _invoke('agents-delete', id),
      toggle:  (id) => _invoke('agents-toggle', id),
      export:  (id) => _invoke('agent-export', id),
      import:  () => _invoke('agent-import'),
    },

    runs: {
      list: (agentId, limit) => _invoke('runs-list', agentId, limit),
      get:  (id) => _invoke('runs-get', id),
    },

    engine: {
      run:        (agentId, triggerData) => _invoke('agent-run', agentId, triggerData),
      cancelRun:  (runId) => _invoke('agent-cancel-run', runId),
      activeRuns: () => _invoke('agent-active-runs'),
      tools:      () => _invoke('tools-list'),
      scheduler:  () => _invoke('scheduler-status'),
    },

    mcp: {
      addServer:    (config) => _invoke('mcp-add-server', config),
      removeServer: (id) => _invoke('mcp-remove-server', id),
      listServers:  () => _invoke('mcp-list-servers'),
      serverTools:  (serverId) => _invoke('mcp-server-tools', serverId),
      callTool:     (toolName, args) => _invoke('mcp-call-tool', toolName, args),
    },

    integrations: {
      list:       () => _invoke('integrations-list'),
      connect:    (id, credentials) => _invoke('integration-connect', id, credentials),
      disconnect: (id) => _invoke('integration-disconnect', id),
      test:       (id, credentials) => _invoke('integration-test', id, credentials),
      action:     (id, actionName, params) => _invoke('integration-action', id, actionName, params),
    },

    oauth: {
      start:             (params) => _invoke('oauth-start', params),
      providers:         () => _invoke('oauth-providers'),
      credentialsList:   () => _invoke('credentials-list'),
      credentialsDelete: (integrationId) => _invoke('credentials-delete', integrationId),
    },

    health: {
      circuitStatus:     () => _invoke('circuit-status'),
      errorBudgetStatus: (integrationId) => _invoke('error-budget-status', integrationId),
    },

    webhooks: {
      generateToken: (agentId) => _invoke('webhook-generate-token', agentId),
      getInfo:       (agentId) => _invoke('webhook-get-info', agentId),
    },

    crews: {
      list:   () => _invoke('crews-list'),
      get:    (id) => _invoke('crews-get', id),
      create: (crew) => _invoke('crews-create', crew),
      update: (id, updates) => _invoke('crews-update', id, updates),
      delete: (id) => _invoke('crews-delete', id),
      run:    (crewId, triggerData) => _invoke('crews-run', crewId, triggerData),
    },

    voice: {
      configure:  (settings) => _invoke('voice-configure', settings),
      getConfig:  () => _invoke('voice-get-config'),
      transcribe: (audioBase64) => _invoke('voice-transcribe', audioBase64),
      synthesize: (text) => _invoke('voice-synthesize', text),
    },

    plugins: {
      list:     () => _invoke('plugins-list'),
      discover: () => _invoke('plugins-discover'),
      load:     (pluginId) => _invoke('plugins-load', pluginId),
      unload:   (pluginId) => _invoke('plugins-unload', pluginId),
      dir:      () => _invoke('plugins-dir'),
    },

    models: {
      list:      () => _invoke('models-list'),
      scanLocal: () => _invoke('models-scan-local'),
      add:       (model) => _invoke('models-add', model),
      delete:    (id) => _invoke('models-delete', id),
      searchHF:  (opts) => _invoke('models-search-hf', opts),
      download:  (opts) => _invoke('models-download', opts),
      onDownloadProgress: (cb) => _on('model-download-progress', cb),
    },

    settings: {
      get:    (key) => _invoke('settings-get', key),
      set:    (key, value) => _invoke('settings-set', key, value),
      getAll: () => _invoke('settings-all'),
    },

    system: {
      info:       () => _invoke('system-info'),
      modelsDir:  () => _invoke('get-models-dir'),
      userData:   () => _invoke('get-user-data'),
      logPath:    () => _invoke('get-log-path'),
      recentLogs: (lines) => _invoke('get-recent-logs', lines),
    },

    knowledgeBase: {
      list:        () => _invoke('kb-list'),
      get:         (id) => _invoke('kb-get', id),
      create:      (data) => _invoke('kb-create', data),
      delete:      (id) => _invoke('kb-delete', id),
      ingest:      (data) => _invoke('kb-ingest', data),
      query:       (data) => _invoke('kb-query', data),
      deleteDoc:   (data) => _invoke('kb-delete-doc', data),
      ensureModel: (model) => _invoke('kb-ensure-model', model),
      selectFile:  () => _invoke('kb-select-file'),
    },

    chat: {
      send: (data) => _invoke('chat-message', data),
      historyList: (limit) => _invoke('chat-history-list', limit),
      historySave: (msg) => _invoke('chat-history-save', msg),
      historyClear: () => _invoke('chat-history-clear'),
    },

    outputFiles: {
      list: () => _invoke('output-files-list'),
      read: (name) => _invoke('output-files-read', name),
    },

    metrics: {
      get: () => _invoke('get-metrics'),
    },

    on: {
      runStarted:      (cb) => _on('run-started', cb),
      runCompleted:    (cb) => _on('run-completed', cb),
      runStep:         (cb) => _on('run-step', cb),
      agentsPauseAll:  (cb) => _on('agents-pause-all', cb),
      agentsResumeAll: (cb) => _on('agents-resume-all', cb),
      agentRunUpdate:  (cb) => _on('agent-run-update', cb),
      modelLoaded:     (cb) => _on('model-loaded', cb),
      llmToken:        (cb) => _on('llm-token', cb),
    },
  };
}
