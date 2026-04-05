/**
 * Mistral AI API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function mistralReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.mistral.ai', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'mistral',
  name: 'Mistral AI',
  category: 'ai',
  icon: 'Zap',
  description: 'Access Mistral AI chat, embeddings, and fine-tuning models.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mistralReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s) available` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages array required');
      return mistralReq('POST', '/chat/completions', { model: params.model || 'mistral-large-latest', messages: params.messages, temperature: params.temperature ?? 0.7, max_tokens: params.max_tokens || 1024 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return mistralReq('POST', '/chat/completions', { model: params.model || 'mistral-large-latest', messages: [{ role: 'user', content: params.prompt }], max_tokens: params.max_tokens || 1024 }, creds);
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      return mistralReq('POST', '/embeddings', { model: params.model || 'mistral-embed', input: Array.isArray(params.input) ? params.input : [params.input] }, creds);
    },
    list_models: async (params, creds) => mistralReq('GET', '/models', null, creds),
    list_files: async (params, creds) => mistralReq('GET', '/files', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
