'use strict';

/**
 * Dax — Electron Preload Script
 * Exposes IPC API to the renderer via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

function _on(channel, callback) {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('__electronPreload', true);
contextBridge.exposeInMainWorld('dax', {
  // ── Platform info ─────────────────────────────────────
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },

  // ── Window controls ───────────────────────────────────
  window: {
    minimize:    () => ipcRenderer.invoke('win-minimize'),
    maximize:    () => ipcRenderer.invoke('win-maximize'),
    close:       () => ipcRenderer.invoke('win-close'),
    isMaximized: () => ipcRenderer.invoke('win-is-maximized'),
  },

  // ── Dialogs ───────────────────────────────────────────
  openFolder:      () => ipcRenderer.invoke('dialog-open-folder'),
  openFile:        (filters) => ipcRenderer.invoke('dialog-open-file', filters),
  openExternal:    (url) => ipcRenderer.invoke('shell-open-external', url),

  // ── Agents ────────────────────────────────────────────
  agents: {
    list:    () => ipcRenderer.invoke('agents-list'),
    get:     (id) => ipcRenderer.invoke('agents-get', id),
    create:  (agent) => ipcRenderer.invoke('agents-create', agent),
    update:  (id, updates) => ipcRenderer.invoke('agents-update', id, updates),
    delete:  (id) => ipcRenderer.invoke('agents-delete', id),
    toggle:  (id) => ipcRenderer.invoke('agents-toggle', id),
    export:  (id) => ipcRenderer.invoke('agent-export', id),
    import:  () => ipcRenderer.invoke('agent-import'),
  },

  // ── Runs ──────────────────────────────────────────────
  runs: {
    list: (agentId, limit) => ipcRenderer.invoke('runs-list', agentId, limit),
    get:  (id) => ipcRenderer.invoke('runs-get', id),
  },

  // ── Agent Execution ───────────────────────────────────
  engine: {
    run:        (agentId, triggerData) => ipcRenderer.invoke('agent-run', agentId, triggerData),
    cancelRun:  (runId) => ipcRenderer.invoke('agent-cancel-run', runId),
    activeRuns: () => ipcRenderer.invoke('agent-active-runs'),
    tools:      () => ipcRenderer.invoke('tools-list'),
    scheduler:  () => ipcRenderer.invoke('scheduler-status'),
  },

  // ── MCP ───────────────────────────────────────────────
  mcp: {
    addServer:    (config) => ipcRenderer.invoke('mcp-add-server', config),
    removeServer: (id) => ipcRenderer.invoke('mcp-remove-server', id),
    listServers:  () => ipcRenderer.invoke('mcp-list-servers'),
    serverTools:  (serverId) => ipcRenderer.invoke('mcp-server-tools', serverId),
    callTool:     (toolName, args) => ipcRenderer.invoke('mcp-call-tool', toolName, args),
  },

  // ── Integrations ──────────────────────────────────────
  integrations: {
    list:       () => ipcRenderer.invoke('integrations-list'),
    connect:    (id, credentials) => ipcRenderer.invoke('integration-connect', id, credentials),
    disconnect: (id) => ipcRenderer.invoke('integration-disconnect', id),
    test:       (id, credentials) => ipcRenderer.invoke('integration-test', id, credentials),
    action:     (id, actionName, params) => ipcRenderer.invoke('integration-action', id, actionName, params),
  },
  // ── OAuth ─────────────────────────────────────────
  oauth: {
    start:           (params) => ipcRenderer.invoke('oauth-start', params),
    providers:       () => ipcRenderer.invoke('oauth-providers'),
    credentialsList: () => ipcRenderer.invoke('credentials-list'),
    credentialsDelete: (integrationId) => ipcRenderer.invoke('credentials-delete', integrationId),
  },
  // ── Health Monitoring ─────────────────────────────────
  health: {
    circuitStatus:     () => ipcRenderer.invoke('circuit-status'),
    errorBudgetStatus: (integrationId) => ipcRenderer.invoke('error-budget-status', integrationId),
  },
  // ── Webhooks ──────────────────────────────────────────
  webhooks: {
    generateToken: (agentId) => ipcRenderer.invoke('webhook-generate-token', agentId),
    getInfo:       (agentId) => ipcRenderer.invoke('webhook-get-info', agentId),
  },

  // ── Crews (Multi-Agent) ───────────────────────────────
  crews: {
    list:   () => ipcRenderer.invoke('crews-list'),
    get:    (id) => ipcRenderer.invoke('crews-get', id),
    create: (crew) => ipcRenderer.invoke('crews-create', crew),
    update: (id, updates) => ipcRenderer.invoke('crews-update', id, updates),
    delete: (id) => ipcRenderer.invoke('crews-delete', id),
    run:    (crewId, triggerData) => ipcRenderer.invoke('crews-run', crewId, triggerData),
  },
  // ── Voice ─────────────────────────────────────────────────
  voice: {
    configure:  (settings) => ipcRenderer.invoke('voice-configure', settings),
    getConfig:  () => ipcRenderer.invoke('voice-get-config'),
    transcribe: (audioBase64) => ipcRenderer.invoke('voice-transcribe', audioBase64),
    synthesize: (text) => ipcRenderer.invoke('voice-synthesize', text),
  },

  // ── Plugins ───────────────────────────────────────────────
  plugins: {
    list:     () => ipcRenderer.invoke('plugins-list'),
    discover: () => ipcRenderer.invoke('plugins-discover'),
    load:     (pluginId) => ipcRenderer.invoke('plugins-load', pluginId),
    unload:   (pluginId) => ipcRenderer.invoke('plugins-unload', pluginId),
    dir:      () => ipcRenderer.invoke('plugins-dir'),
  },
  // ── Models ────────────────────────────────────────────
  models: {
    list:      () => ipcRenderer.invoke('models-list'),
    scanLocal: () => ipcRenderer.invoke('models-scan-local'),
    add:       (model) => ipcRenderer.invoke('models-add', model),
    delete:    (id) => ipcRenderer.invoke('models-delete', id),
    searchHF:  (opts) => ipcRenderer.invoke('models-search-hf', opts),
    download:  (opts) => ipcRenderer.invoke('models-download', opts),
    onDownloadProgress: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on('model-download-progress', handler);
      return () => ipcRenderer.removeListener('model-download-progress', handler);
    },
  },

  // ── Settings ──────────────────────────────────────────
  settings: {
    get:    (key) => ipcRenderer.invoke('settings-get', key),
    set:    (key, value) => ipcRenderer.invoke('settings-set', key, value),
    getAll: () => ipcRenderer.invoke('settings-all'),
  },

  // ── System ────────────────────────────────────────────
  system: {
    info:       () => ipcRenderer.invoke('system-info'),
    modelsDir:  () => ipcRenderer.invoke('get-models-dir'),
    userData:   () => ipcRenderer.invoke('get-user-data'),
    logPath:    () => ipcRenderer.invoke('get-log-path'),
    recentLogs: (lines) => ipcRenderer.invoke('get-recent-logs', lines),
  },

  // ── Knowledge Base / RAG ───────────────────────────────
  knowledgeBase: {
    list:        () => ipcRenderer.invoke('kb-list'),
    get:         (id) => ipcRenderer.invoke('kb-get', id),
    create:      (data) => ipcRenderer.invoke('kb-create', data),
    delete:      (id) => ipcRenderer.invoke('kb-delete', id),
    ingest:      (data) => ipcRenderer.invoke('kb-ingest', data),
    query:       (data) => ipcRenderer.invoke('kb-query', data),
    deleteDoc:   (data) => ipcRenderer.invoke('kb-delete-doc', data),
    ensureModel: (model) => ipcRenderer.invoke('kb-ensure-model', model),
    selectFile:  () => ipcRenderer.invoke('kb-select-file'),
  },

  // ── Events ────────────────────────────────────────────
  on: {
    runStarted:      (cb) => _on('run-started', cb),
    runCompleted:    (cb) => _on('run-completed', cb),
    runStep:         (cb) => _on('run-step', cb),
    agentsPauseAll:  (cb) => _on('agents-pause-all', cb),
    agentsResumeAll: (cb) => _on('agents-resume-all', cb),
    agentRunUpdate:  (cb) => _on('agent-run-update', cb),
    modelLoaded:     (cb) => _on('model-loaded', cb),
    modelLoading:    (cb) => _on('model-loading', cb),
    modelError:      (cb) => _on('model-error', cb),
    llmToken:        (cb) => _on('llm-token', cb),
    llmStatus:       (cb) => _on('llm-status', cb),
    notification:    (cb) => _on('notification', cb),
    navigate:        (cb) => _on('navigate', cb),
    oauthSuccess:    (cb) => _on('oauth-success', cb),
    oauthError:      (cb) => _on('oauth-error', cb),
  },

  // ── Auto-updater ─────────────────────────────────────
  updates: {
    check:    () => ipcRenderer.invoke('update-check'),
    download: () => ipcRenderer.invoke('update-download'),
    install:  () => ipcRenderer.invoke('update-install'),
    onStatus: (cb) => _on('update-status', cb),
  },

  // ── Chat (ephemeral LLM) ──────────────────────────────
  chat: {
    send: (data) => ipcRenderer.invoke('chat-message', data),
    historyList: (limit) => ipcRenderer.invoke('chat-history-list', limit),
    historySave: (msg) => ipcRenderer.invoke('chat-history-save', msg),
    historyClear: () => ipcRenderer.invoke('chat-history-clear'),
  },

  // ── Output Files ─────────────────────────────────────
  outputFiles: {
    list: () => ipcRenderer.invoke('output-files-list'),
    read: (name) => ipcRenderer.invoke('output-files-read', name),
  },
  metrics: {
    get: () => ipcRenderer.invoke('get-metrics'),
  },
});
