/**
 * Cohere API Integration
 */
'use strict';
const https = require('https');

function coApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.cohere.ai', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } };
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
  id: 'cohere',
  name: 'Cohere',
  category: 'ai-ml',
  icon: 'Wand2',
  description: 'Generate text, embeddings, and classify content with Cohere AI.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await coApi('POST', '/tokenize', creds.api_key, { text: 'hello', model: 'command' }); return { success: Array.isArray(r.tokens), message: 'Connected to Cohere' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    generate: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      return coApi('POST', '/generate', creds.api_key, { prompt: params.prompt, model: params.model || 'command', max_tokens: params.max_tokens || 300, temperature: params.temperature || 0.9, num_generations: params.num_generations || 1 });
    },
    chat: async (params, creds) => {
      if (!params.message) throw new Error('message required');
      return coApi('POST', '/chat', creds.api_key, { message: params.message, model: params.model || 'command-r', chat_history: params.chat_history || [], temperature: params.temperature || 0.3 });
    },
    embed: async (params, creds) => {
      if (!params.texts) throw new Error('texts (array) required');
      return coApi('POST', '/embed', creds.api_key, { texts: params.texts, model: params.model || 'embed-english-v3.0', input_type: params.input_type || 'search_document' });
    },
    classify: async (params, creds) => {
      if (!params.inputs || !params.examples) throw new Error('inputs and examples required');
      return coApi('POST', '/classify', creds.api_key, { inputs: params.inputs, examples: params.examples, model: params.model || 'embed-english-v2.0' });
    },
    summarize: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      return coApi('POST', '/summarize', creds.api_key, { text: params.text, model: params.model || 'command', length: params.length || 'medium', format: params.format || 'paragraph' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
