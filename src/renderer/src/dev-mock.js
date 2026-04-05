// ─── Dev Mock for window.dax ────────────────────────────────
// When running in a browser (not Electron), this provides mock data
// so the UI can be tested without the Electron main process.

if (typeof window !== 'undefined' && !window.__electronPreload) {
  // Only inject if we're NOT in real Electron (preload sets __electronPreload)
  // Re-inject on every HMR cycle to keep closures fresh
  console.log('[DEV MOCK] Injecting window.dax mock for browser testing');

  // Persist mock state on window so HMR doesn't reset it
  if (!window._mockState) {
    window._mockState = { agents: [], runs: [] };
  }
  const mockAgents = window._mockState.agents;
  const mockRuns = window._mockState.runs;

  const mockIntegrations = [
    { id: 'slack', name: 'Slack', category: 'communication', icon: 'MessageSquare', description: 'Send messages and interact with Slack', connected: false, actions: ['send_message', 'list_channels', 'read_messages', 'add_reaction', 'set_topic'], configFields: [{ key: 'bot_token', label: 'Bot Token (xoxb-...)', type: 'password', required: true }, { key: 'default_channel', label: 'Default Channel ID', type: 'text', placeholder: 'C0123456789' }] },
    { id: 'discord', name: 'Discord', category: 'communication', icon: 'MessageCircle', description: 'Send messages and manage Discord servers', connected: false, actions: ['send_message', 'list_guilds', 'list_channels', 'read_messages', 'create_thread'], configFields: [{ key: 'bot_token', label: 'Bot Token', type: 'password', required: true }, { key: 'default_channel_id', label: 'Default Channel ID', type: 'text' }] },
    { id: 'twilio', name: 'Twilio', category: 'communication', icon: 'Phone', description: 'Send SMS, make calls, and message via WhatsApp', connected: false, actions: ['send_sms', 'send_whatsapp', 'make_call', 'list_messages', 'check_balance'], configFields: [{ key: 'account_sid', label: 'Account SID', type: 'text', required: true }, { key: 'auth_token', label: 'Auth Token', type: 'password', required: true }, { key: 'from_number', label: 'Phone Number', type: 'text', required: true }] },
    { id: 'google-sheets', name: 'Google Sheets', category: 'productivity', icon: 'Table', description: 'Read and search spreadsheets', connected: false, actions: ['read_range', 'get_spreadsheet_info', 'search_cells'], configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }, { key: 'default_spreadsheet_id', label: 'Default Spreadsheet ID', type: 'text' }] },
    { id: 'database', name: 'Database', category: 'database', icon: 'Database', description: 'Query SQLite databases', connected: false, actions: ['query', 'list_tables', 'describe_table'], configFields: [{ key: 'type', label: 'Type', type: 'select', options: ['sqlite', 'postgresql', 'mysql'] }, { key: 'connection_string', label: 'Connection String', type: 'text' }] },
    { id: 'email', name: 'Email (SMTP)', category: 'communication', icon: 'Mail', description: 'Send emails via SMTP', connected: false, actions: ['send_email'], configFields: [{ key: 'smtp_host', label: 'SMTP Host', type: 'text', required: true }, { key: 'smtp_port', label: 'SMTP Port', type: 'text' }, { key: 'smtp_user', label: 'Username', type: 'text', required: true }, { key: 'smtp_pass', label: 'Password', type: 'password', required: true }] },
    { id: 'github', name: 'GitHub', category: 'development', icon: 'Github', description: 'Manage repos, issues, and pull requests', connected: false, actions: ['list_repos', 'create_issue', 'list_issues', 'add_comment', 'list_pulls', 'get_file'], configFields: [{ key: 'token', label: 'Personal Access Token', type: 'password', required: true }, { key: 'default_owner', label: 'Default Owner', type: 'text' }, { key: 'default_repo', label: 'Default Repo', type: 'text' }] },
    { id: 'notion', name: 'Notion', category: 'productivity', icon: 'FileText', description: 'Search, read, and create Notion pages', connected: false, actions: ['search', 'get_page', 'get_page_content', 'create_page', 'query_database'], configFields: [{ key: 'token', label: 'Integration Token', type: 'password', required: true }] },
    { id: 'http-rest', name: 'HTTP / REST', category: 'utility', icon: 'Globe', description: 'Call any REST API', connected: false, actions: ['request', 'get', 'post'], configFields: [{ key: 'base_url', label: 'Base URL', type: 'text' }, { key: 'default_headers', label: 'Default Headers (JSON)', type: 'text' }] },
    { id: 'google-calendar', name: 'Google Calendar', category: 'productivity', icon: 'Calendar', description: 'Read calendar events', connected: false, actions: ['list_events', 'get_event', 'busy_check'], configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }, { key: 'calendar_id', label: 'Calendar ID', type: 'text' }] },
    { id: 'filesystem', name: 'File System', category: 'utility', icon: 'FolderOpen', description: 'Sandboxed file operations', connected: false, actions: ['read_file', 'write_file', 'list_dir', 'file_info'], configFields: [{ key: 'allowed_dirs', label: 'Allowed Directories', type: 'text', required: true }] },
    { id: 'telegram', name: 'Telegram', category: 'communication', icon: 'Send', description: 'Send messages via Telegram bots', connected: false, actions: ['send_message', 'get_updates', 'get_chat'], configFields: [{ key: 'bot_token', label: 'Bot Token', type: 'password', required: true }, { key: 'default_chat_id', label: 'Default Chat ID', type: 'text' }] },
  ];

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  window.dax = {
    platform: 'win32',
    versions: { electron: '33.0.0', node: '25.2.1', chrome: '130.0.0' },

    window: {
      minimize: async () => console.log('[MOCK] minimize'),
      maximize: async () => console.log('[MOCK] maximize'),
      close: async () => console.log('[MOCK] close'),
      isMaximized: async () => false,
    },

    openFolder: async () => null,
    openFile: async () => null,
    openExternal: async (url) => { console.log('[MOCK] openExternal:', url); window.open(url, '_blank'); },

    agents: {
      list: async () => { await delay(100); return [...mockAgents]; },
      get: async (id) => { await delay(50); return mockAgents.find((a) => a.id === id) || null; },
      create: async (agent) => {
        const newAgent = { ...agent, id: 'agent-' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), run_count: 0 };
        mockAgents.push(newAgent);
        return newAgent;
      },
      update: async (id, updates) => {
        const idx = mockAgents.findIndex((a) => a.id === id);
        if (idx >= 0) Object.assign(mockAgents[idx], updates, { updated_at: new Date().toISOString() });
        return { success: true };
      },
      delete: async (id) => {
        const idx = mockAgents.findIndex((a) => a.id === id);
        if (idx >= 0) mockAgents.splice(idx, 1);
        return { success: true };
      },
      toggle: async (id) => {
        const agent = mockAgents.find((a) => a.id === id);
        if (agent) agent.enabled = !agent.enabled;
        return { success: true, enabled: agent ? agent.enabled : false };
      },
      export: async (id) => { console.log('[MOCK] export agent:', id); return { success: true }; },
      import: async () => { console.log('[MOCK] import agent'); return null; },
    },

    runs: {
      list: async (agentId, limit) => {
        await delay(80);
        let runs = [...mockRuns];
        if (agentId) runs = runs.filter((r) => r.agent_id === agentId);
        if (limit) runs = runs.slice(0, limit);
        return runs;
      },
      get: async (id) => { await delay(50); return mockRuns.find((r) => r.id === id) || null; },
    },

    engine: {
      run: async (agentId, triggerData) => {
        const agent = mockAgents.find(a => a.id === agentId);
        if (!agent) return { error: 'Agent not found' };
        
        const runId = 'run-' + Date.now();
        const startedAt = new Date().toISOString();
        
        // Create run record
        const run = {
          id: runId,
          agent_id: agentId,
          agent_name: agent.name,
          status: 'running',
          trigger_data: JSON.stringify(triggerData || { trigger: 'manual' }),
          started_at: startedAt,
          result: null,
          tokens_used: 0,
        };
        mockRuns.unshift(run);
        
        try {
          // Call real Ollama API
          const systemPrompt = agent.system_prompt || 'You are a helpful AI agent.';
          const userMessage = (triggerData && triggerData.message) || triggerData?.prompt || 
            `Agent triggered. Data: ${JSON.stringify(triggerData || {})}`;
          
          const response = await fetch('http://localhost:11434/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'qwen3.5:2b',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
              ],
              stream: false,
              options: { num_predict: agent.token_budget || 512, temperature: agent.temperature || 0.7 },
            }),
          });
          
          const data = await response.json();
          const result = data.choices?.[0]?.message?.content || 'No response';
          const tokens = data.usage?.total_tokens || 0;
          
          run.status = 'completed';
          run.result = JSON.stringify({ output: result });
          run.tokens_used = tokens;
          run.completed_at = new Date().toISOString();
          run.duration_ms = Date.now() - new Date(startedAt).getTime();
          
          return { runId, status: 'completed', result, tokens };
        } catch (err) {
          run.status = 'error';
          run.result = JSON.stringify({ error: err.message });
          run.completed_at = new Date().toISOString();
          return { runId, status: 'error', error: err.message };
        }
      },
      cancelRun: async (runId) => { console.log('[MOCK] cancel run:', runId); return { success: true }; },
      activeRuns: async () => [],
      tools: async () => [
        { name: 'web_search', description: 'Search the web' },
        { name: 'read_file', description: 'Read a file' },
        { name: 'write_file', description: 'Write a file' },
      ],
      scheduler: async () => ({ running: 0, scheduled: 1 }),
    },

    mcp: {
      addServer: async (config) => { console.log('[MOCK] add MCP server:', config); return { id: 'mcp-' + Date.now(), ...config }; },
      removeServer: async (id) => { console.log('[MOCK] remove MCP server:', id); return { success: true }; },
      listServers: async () => [],
      serverTools: async () => [],
      callTool: async (name, args) => { console.log('[MOCK] call MCP tool:', name, args); return { result: 'mock' }; },
    },

    integrations: {
      list: async () => { await delay(100); return [...mockIntegrations]; },
      connect: async (id, creds) => { console.log('[MOCK] connect integration:', id); const int = mockIntegrations.find((i) => i.id === id); if (int) int.connected = true; return { success: true }; },
      disconnect: async (id) => { const int = mockIntegrations.find((i) => i.id === id); if (int) int.connected = false; return { success: true }; },
      test: async (id, creds) => { await delay(500); return { success: true, message: 'Connection test passed (mock)' }; },
      action: async (id, action, params) => { console.log('[MOCK] integration action:', id, action, params); return { result: 'mock' }; },
    },

    webhooks: {
      generateToken: async (agentId) => { return { token: 'mock-token-' + Date.now() }; },
      getInfo: async (agentId) => { return { token: null, url: null, port: 3700 }; },
    },

    crews: {
      list: async () => [],
      get: async (id) => null,
      create: async (crew) => { return { id: 'crew-' + Date.now(), ...crew, created_at: new Date().toISOString() }; },
      update: async (id, updates) => { return { success: true }; },
      delete: async (id) => { return { success: true }; },
      run: async (crewId, triggerData) => { return { crew_id: crewId, strategy: 'sequential', rounds: 1, results: [], final_output: 'Mock crew result' }; },
    },

    knowledgeBase: {
      list: async () => [],
      get: async (id) => ({ id, name: 'Mock KB', description: '', model: 'nomic-embed-text', chunk_size: 512, overlap: 50, doc_count: 0, chunk_count: 0, documents: [] }),
      create: async (data) => ({ id: 'kb-' + Date.now(), ...data, doc_count: 0, chunk_count: 0, created_at: new Date().toISOString() }),
      delete: async (id) => ({ success: true }),
      ingest: async (data) => { await delay(1000); return { doc_id: 'doc-mock', chunks: 10, filename: data.file_path || 'text-input' }; },
      query: async (data) => ({ chunks: [{ text: 'Mock relevant chunk...', doc_id: 'doc-mock', chunk_index: 0, score: 0.95 }], query: data.question }),
      deleteDoc: async (data) => ({ success: true }),
      ensureModel: async (model) => ({ available: true, model: model || 'nomic-embed-text' }),
      selectFile: async () => [],
    },

    voice: {
      configure: async (settings) => { console.log('[MOCK] voice configure:', settings); return { success: true }; },
      getConfig: async () => ({ sttBackend: 'webSpeech', ttsBackend: 'webSpeech', notifications: true, settings: {} }),
      transcribe: async (audio) => { await delay(1000); return { text: 'This is a mock transcription result.' }; },
      synthesize: async (text) => ({ useWebSpeech: true, text }),
    },

    plugins: {
      list: async () => [],
      discover: async () => [],
      load: async (id) => { console.log('[MOCK] load plugin:', id); return { success: true }; },
      unload: async (id) => { console.log('[MOCK] unload plugin:', id); return { success: true }; },
      dir: async () => 'C:\\Users\\user\\AppData\\Roaming\\dax\\plugins',
    },

    models: {
      list: async () => [
        { id: 'qwen3.5-2b', name: 'qwen3.5:2b', provider: 'ollama', type: 'local', model_path: 'http://localhost:11434/v1', supports_tools: null },
        { id: 'qwen3-1.7b', name: 'qwen3:1.7b', provider: 'ollama', type: 'local', model_path: 'http://localhost:11434/v1', supports_tools: null },
        { id: 'qwen2.5-3b', name: 'qwen2.5-3b', provider: 'ollama', type: 'local', model_path: 'http://localhost:11434/v1', supports_tools: null },
      ],
      scanLocal: async () => [],
      add: async (model) => { console.log('[MOCK] add model:', model); return { success: true }; },
      delete: async (id) => { console.log('[MOCK] delete model:', id); return { success: true }; },
    },

    settings: {
      get: async (key) => null,
      set: async (key, value) => { console.log('[MOCK] set setting:', key, value); return { success: true }; },
      getAll: async () => ({}),
    },

    system: {
      info: async () => ({ platform: 'win32', arch: 'x64', cpus: 8, totalMemory: 16000000000, freeMemory: 8000000000 }),
      modelsDir: async () => 'C:\\Users\\user\\.ollama\\models',
      userData: async () => 'C:\\Users\\user\\AppData\\Roaming\\dax',
      logPath: async () => 'C:\\Users\\user\\AppData\\Roaming\\dax\\logs',
      recentLogs: async () => '[2024-01-01] App started\n[2024-01-01] Agent ran\n',
    },

    on: {
      runStarted: (cb) => () => {},
      runCompleted: (cb) => () => {},
      agentsPauseAll: (cb) => () => {},
      agentsResumeAll: (cb) => () => {},
      agentRunUpdate: (cb) => () => {},
      modelLoaded: (cb) => () => {},
      modelLoading: (cb) => () => {},
      modelError: (cb) => () => {},
      llmToken: (cb) => () => {},
      llmStatus: (cb) => () => {},
      notification: (cb) => () => {},
      navigate: (cb) => () => {},
    },
  };
}
