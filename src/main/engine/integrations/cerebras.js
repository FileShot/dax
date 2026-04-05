/**
 * Cerebras Cloud API Integration (OpenAI-compatible)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function cbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.cerebras.ai', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'cerebras',
  name: 'Cerebras',
  category: 'ai',
  icon: 'Cpu',
  description: 'Ultra-fast Llama inference on Cerebras wafer-scale silicon (OpenAI-compatible).',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cbReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return cbReq('POST', '/chat/completions', { model: params.model || 'llama3.3-70b', messages: params.messages, max_completion_tokens: params.max_tokens || 1024, temperature: params.temperature ?? 0.7 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return cbReq('POST', '/chat/completions', { model: params.model || 'llama3.3-70b', messages: [{ role: 'user', content: params.prompt }], max_completion_tokens: params.max_tokens || 1024 }, creds);
    },
    stream_chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return cbReq('POST', '/chat/completions', { model: params.model || 'llama3.3-70b', messages: params.messages, stream: true, max_completion_tokens: params.max_tokens || 1024 }, creds);
    },
    list_models: async (params, creds) => cbReq('GET', '/models', null, creds),
    get_model: async (params, creds) => {
      if (!params.model_id) throw new Error('model_id required');
      return cbReq('GET', `/models/${params.model_id}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
