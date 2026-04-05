/**
 * DeepSeek AI API Integration (OpenAI-compatible)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dsReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.deepseek.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'deepseek',
  name: 'DeepSeek',
  category: 'ai',
  icon: 'Search',
  description: 'Access DeepSeek AI models for reasoning, coding, and chat (OpenAI-compatible API).',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dsReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s) available` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return dsReq('POST', '/chat/completions', { model: params.model || 'deepseek-chat', messages: params.messages, max_tokens: params.max_tokens || 2048, temperature: params.temperature ?? 0.7 }, creds);
    },
    reason: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return dsReq('POST', '/chat/completions', { model: 'deepseek-reasoner', messages: [{ role: 'user', content: params.prompt }], max_tokens: params.max_tokens || 4096 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return dsReq('POST', '/completions', { model: params.model || 'deepseek-chat', prompt: params.prompt, max_tokens: params.max_tokens || 512 }, creds);
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      return dsReq('POST', '/embeddings', { model: 'deepseek-embedding', input: Array.isArray(params.input) ? params.input : [params.input] }, creds);
    },
    list_models: async (params, creds) => dsReq('GET', '/models', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
