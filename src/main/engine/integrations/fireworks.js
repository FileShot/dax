/**
 * Fireworks AI API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fwReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.fireworks.ai', path: `/inference/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'fireworks',
  name: 'Fireworks AI',
  category: 'ai',
  icon: 'Flame',
  description: 'Deploy and run generative AI models on Fireworks AI — fast inference for LLMs and image models.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fwReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return fwReq('POST', '/chat/completions', { model: params.model || 'accounts/fireworks/models/llama-v3p1-70b-instruct', messages: params.messages, max_tokens: params.max_tokens || 1024, temperature: params.temperature ?? 0.7 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return fwReq('POST', '/completions', { model: params.model || 'accounts/fireworks/models/llama-v3p1-70b-instruct', prompt: params.prompt, max_tokens: params.max_tokens || 512 }, creds);
    },
    generate_image: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return fwReq('POST', '/image_generation/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0', { prompt: params.prompt, cfg_scale: params.cfg_scale || 7, height: params.height || 1024, width: params.width || 1024, num_inference_steps: params.steps || 30 }, creds);
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      return fwReq('POST', '/embeddings', { model: params.model || 'nomic-ai/nomic-embed-text-v1.5', input: Array.isArray(params.input) ? params.input : [params.input] }, creds);
    },
    list_models: async (params, creds) => fwReq('GET', '/models', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
