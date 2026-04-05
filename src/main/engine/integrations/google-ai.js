/**
 * Google AI (Gemini) API Integration
 */
'use strict';
const https = require('https');

function geminiApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method, hostname: 'generativelanguage.googleapis.com', path: `/v1beta${path}${sep}key=${apiKey}`, headers: { 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'google-ai',
  name: 'Google AI (Gemini)',
  category: 'ai-ml',
  icon: 'Bot',
  description: 'Generate text, analyze images, and create embeddings with Google Gemini.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await geminiApi('GET', '/models', creds.api_key); return { success: Array.isArray(r.models), message: `${r.models?.length || 0} model(s) available` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    generate_content: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      const model = params.model || 'gemini-1.5-flash';
      const body = { contents: [{ parts: [{ text: params.prompt }] }], generationConfig: { temperature: params.temperature || 1, maxOutputTokens: params.max_tokens || 2048 } };
      return geminiApi('POST', `/models/${model}:generateContent`, creds.api_key, body);
    },
    embed_content: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const model = params.model || 'text-embedding-004';
      return geminiApi('POST', `/models/${model}:embedContent`, creds.api_key, { content: { parts: [{ text: params.text }] }, taskType: params.task_type || 'RETRIEVAL_DOCUMENT' });
    },
    list_models: async (params, creds) => geminiApi('GET', '/models', creds.api_key),
    count_tokens: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      const model = params.model || 'gemini-1.5-flash';
      return geminiApi('POST', `/models/${model}:countTokens`, creds.api_key, { contents: [{ parts: [{ text: params.prompt }] }] });
    },
    start_chat: async (params, creds) => {
      if (!params.message) throw new Error('message required');
      const model = params.model || 'gemini-1.5-flash';
      const history = (params.history || []).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const contents = [...history, { role: 'user', parts: [{ text: params.message }] }];
      return geminiApi('POST', `/models/${model}:generateContent`, creds.api_key, { contents });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
