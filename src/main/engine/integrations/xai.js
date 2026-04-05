/**
 * xAI (Grok) API Integration — OpenAI-compatible
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function xaiReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.x.ai', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'xai',
  name: 'xAI (Grok)',
  category: 'ai',
  icon: 'Twitter',
  description: 'Access xAI\'s Grok models — live knowledge, reasoning, and vision (OpenAI-compatible API).',
  configFields: [{ key: 'api_key', label: 'xAI API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await xaiReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s) available` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return xaiReq('POST', '/chat/completions', { model: params.model || 'grok-3-latest', messages: params.messages, max_tokens: params.max_tokens || 1024, temperature: params.temperature ?? 0.7 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return xaiReq('POST', '/chat/completions', { model: params.model || 'grok-3-latest', messages: [{ role: 'user', content: params.prompt }], max_tokens: params.max_tokens || 1024 }, creds);
    },
    generate_image: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return xaiReq('POST', '/images/generations', { model: params.model || 'grok-2-image', prompt: params.prompt, n: params.n || 1, response_format: params.response_format || 'url' }, creds);
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      return xaiReq('POST', '/embeddings', { model: params.model || 'v1', input: Array.isArray(params.input) ? params.input : [params.input] }, creds);
    },
    list_models: async (params, creds) => xaiReq('GET', '/models', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
