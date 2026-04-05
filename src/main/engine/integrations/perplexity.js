/**
 * Perplexity AI API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ppxReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.perplexity.ai', path, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'perplexity',
  name: 'Perplexity AI',
  category: 'ai',
  icon: 'Globe',
  description: 'Ask Perplexity AI questions with real-time web search grounding — sonar models.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await ppxReq('POST', '/chat/completions', { model: 'sonar', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }, creds);
      return { success: true, message: `Connected — model: ${r.model}` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return ppxReq('POST', '/chat/completions', { model: params.model || 'sonar-pro', messages: [{ role: 'user', content: params.query }], max_tokens: params.max_tokens || 1024 }, creds);
    },
    chat: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return ppxReq('POST', '/chat/completions', { model: params.model || 'sonar', messages: params.messages, max_tokens: params.max_tokens || 1024, temperature: params.temperature ?? 0.7 }, creds);
    },
    deep_research: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return ppxReq('POST', '/chat/completions', { model: 'sonar-deep-research', messages: [{ role: 'user', content: params.query }], max_tokens: params.max_tokens || 4096 }, creds);
    },
    reason: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return ppxReq('POST', '/chat/completions', { model: 'sonar-reasoning-pro', messages: [{ role: 'user', content: params.prompt }], max_tokens: params.max_tokens || 2048 }, creds);
    },
    complete: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return ppxReq('POST', '/chat/completions', { model: params.model || 'sonar', messages: [{ role: 'user', content: params.prompt }], max_tokens: params.max_tokens || 1024 }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
