/**
 * Ollama Local LLM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ollamaReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = (creds.host || 'localhost').replace(/^https?:\/\//, '');
  const [hostname, portStr] = host.split(':');
  const port = parseInt(portStr || '11434', 10);
  const opts = { method, hostname, port, path: `/api${path}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'ollama',
  name: 'Ollama',
  category: 'ai',
  icon: 'Monitor',
  description: 'Run large language models locally with Ollama — pull, chat, and embed without the cloud.',
  configFields: [
    { key: 'host', label: 'Ollama Host (default: localhost:11434)', type: 'text', required: false, placeholder: 'localhost:11434' },
  ],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ollamaReq('GET', '/tags', null, creds); return { success: true, message: `${(r.models || []).length} model(s) loaded` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.model || !params.messages) throw new Error('model and messages required');
      return ollamaReq('POST', '/chat', { model: params.model, messages: params.messages, stream: false, options: { temperature: params.temperature ?? 0.7, num_predict: params.max_tokens || 1024 } }, creds);
    },
    generate: async (params, creds) => {
      if (!params.model || !params.prompt) throw new Error('model and prompt required');
      return ollamaReq('POST', '/generate', { model: params.model, prompt: params.prompt, stream: false, options: { num_predict: params.max_tokens || 512 } }, creds);
    },
    embed: async (params, creds) => {
      if (!params.model || !params.input) throw new Error('model and input required');
      return ollamaReq('POST', '/embed', { model: params.model, input: Array.isArray(params.input) ? params.input : [params.input] }, creds);
    },
    pull_model: async (params, creds) => {
      if (!params.model) throw new Error('model name required');
      return ollamaReq('POST', '/pull', { name: params.model, stream: false }, creds);
    },
    list_models: async (params, creds) => ollamaReq('GET', '/tags', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
