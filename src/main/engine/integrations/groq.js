/**
 * Groq Cloud API Integration (OpenAI-compatible)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function groqReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.groq.com', path: `/openai/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'groq',
  name: 'Groq',
  category: 'ai',
  icon: 'Cpu',
  description: 'Ultra-fast LLM inference via Groq Cloud — Llama, Mixtral, Gemma, and more.',
  configFields: [{ key: 'api_key', label: 'Groq API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await groqReq('GET', '/models', null, creds); return { success: true, message: `${(r.data || []).length} model(s) available` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages array required');
      return groqReq('POST', '/chat/completions', { model: params.model || 'llama3-70b-8192', messages: params.messages, temperature: params.temperature ?? 0.7, max_tokens: params.max_tokens || 1024 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return groqReq('POST', '/chat/completions', { model: params.model || 'llama3-70b-8192', messages: [{ role: 'user', content: params.prompt }], max_tokens: params.max_tokens || 1024 }, creds);
    },
    transcribe: async (params, creds) => {
      if (!params.file_url) throw new Error('file_url required');
      return groqReq('POST', '/audio/transcriptions', { model: 'whisper-large-v3', url: params.file_url, language: params.language || 'en' }, creds);
    },
    list_models: async (params, creds) => groqReq('GET', '/models', null, creds),
    get_usage: async (params, creds) => groqReq('GET', '/usage', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
