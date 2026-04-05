/**
 * DeepInfra API Integration (OpenAI-compatible)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function diReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.deepinfra.com', path: `/v1/openai${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'deepinfra',
  name: 'DeepInfra',
  category: 'ai',
  icon: 'Server',
  description: 'Deploy and infer open-source AI models on DeepInfra (OpenAI-compatible endpoint).',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await diReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return diReq('POST', '/chat/completions', { model: params.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct', messages: params.messages, max_tokens: params.max_tokens || 1024, temperature: params.temperature ?? 0.7 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return diReq('POST', '/completions', { model: params.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct', prompt: params.prompt, max_tokens: params.max_tokens || 512 }, creds);
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      return diReq('POST', '/embeddings', { model: params.model || 'BAAI/bge-base-en-v1.5', input: Array.isArray(params.input) ? params.input : [params.input] }, creds);
    },
    generate_image: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return diReq('POST', '/images/generations', { model: params.model || 'black-forest-labs/FLUX-1-schnell', prompt: params.prompt, n: params.n || 1, num_inference_steps: params.steps || 4 }, creds);
    },
    list_models: async (params, creds) => diReq('GET', '/models', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
