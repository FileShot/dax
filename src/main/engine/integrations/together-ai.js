/**
 * Together AI API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function togetherReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.together.xyz', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'together-ai',
  name: 'Together AI',
  category: 'ai',
  icon: 'Users',
  description: 'Run 100+ open-source AI models at scale with Together AI cloud inference.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await togetherReq('GET', '/models', null, creds); return { success: true, message: `${(Array.isArray(r) ? r : r.data || []).length} model(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return togetherReq('POST', '/chat/completions', { model: params.model || 'meta-llama/Llama-3-70b-chat-hf', messages: params.messages, max_tokens: params.max_tokens || 1024, temperature: params.temperature ?? 0.7 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return togetherReq('POST', '/completions', { model: params.model || 'meta-llama/Llama-3-70b-hf', prompt: params.prompt, max_tokens: params.max_tokens || 512 }, creds);
    },
    generate_image: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return togetherReq('POST', '/images/generations', { model: params.model || 'stabilityai/stable-diffusion-xl-base-1.0', prompt: params.prompt, n: params.n || 1, width: params.width || 1024, height: params.height || 1024 }, creds);
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      return togetherReq('POST', '/embeddings', { model: params.model || 'togethercomputer/m2-bert-80M-8k-retrieval', input: params.input }, creds);
    },
    list_models: async (params, creds) => togetherReq('GET', '/models', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
