/**
 * Anthropic Claude API Integration
 */
'use strict';
const https = require('https');

function claudeApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.anthropic.com', path: `/v1${path}`, headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' } };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'anthropic',
  name: 'Anthropic Claude',
  category: 'ai',
  icon: 'Sparkles',
  description: 'Access Anthropic Claude models for chat and analysis.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: 'claude-3-haiku-20240307', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] });
      return { success: !!r.id, message: r.id ? 'Connected to Claude API' : `Error: ${r.error?.message || 'Unknown'}` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages && !params.prompt) throw new Error('messages array or prompt required');
      const messages = params.messages || [{ role: 'user', content: params.prompt }];
      const body = { model: params.model || 'claude-sonnet-4-20250514', max_tokens: params.max_tokens || 1024, messages };
      if (params.system) body.system = params.system;
      if (params.temperature !== undefined) body.temperature = params.temperature;
      const r = await claudeApi('POST', '/messages', creds.api_key, body);
      if (r.error) throw new Error(r.error.message);
      return { content: r.content?.[0]?.text, usage: r.usage, model: r.model, id: r.id, stop_reason: r.stop_reason };
    },
    analyze: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const system = params.system || 'Analyze the following text and provide insights.';
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: params.model || 'claude-sonnet-4-20250514', max_tokens: params.max_tokens || 2048, system, messages: [{ role: 'user', content: params.text }] });
      if (r.error) throw new Error(r.error.message);
      return { analysis: r.content?.[0]?.text, usage: r.usage };
    },
    summarize: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: params.model || 'claude-sonnet-4-20250514', max_tokens: params.max_tokens || 1024, system: 'Summarize the following text concisely.', messages: [{ role: 'user', content: params.text }] });
      if (r.error) throw new Error(r.error.message);
      return { summary: r.content?.[0]?.text, usage: r.usage };
    },

    extract: async (params, creds) => {
      if (!params.text || !params.schema) throw new Error('text and schema required');
      const system = `Extract the following fields from the text and return as JSON: ${JSON.stringify(params.schema)}. Return ONLY valid JSON.`;
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: params.model || 'claude-3-haiku-20240307', max_tokens: 2048, system, messages: [{ role: 'user', content: params.text }] });
      if (r.error) throw new Error(r.error.message);
      try { return { extracted: JSON.parse(r.content?.[0]?.text), usage: r.usage }; } catch { return { raw: r.content?.[0]?.text, usage: r.usage }; }
    },

    classify: async (params, creds) => {
      if (!params.text || !params.categories) throw new Error('text and categories array required');
      const system = `Classify the following text into one of these categories: ${params.categories.join(', ')}. Respond with ONLY the category name.`;
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: params.model || 'claude-3-haiku-20240307', max_tokens: 100, system, messages: [{ role: 'user', content: params.text }] });
      if (r.error) throw new Error(r.error.message);
      return { category: r.content?.[0]?.text?.trim(), usage: r.usage };
    },

    translate: async (params, creds) => {
      if (!params.text || !params.target_language) throw new Error('text and target_language required');
      const system = `Translate the following text to ${params.target_language}. Return ONLY the translation.`;
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: params.model || 'claude-3-haiku-20240307', max_tokens: params.max_tokens || 2048, system, messages: [{ role: 'user', content: params.text }] });
      if (r.error) throw new Error(r.error.message);
      return { translation: r.content?.[0]?.text, usage: r.usage };
    },

    generate_code: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      const language = params.language ? ` in ${params.language}` : '';
      const system = `You are an expert programmer. Generate clean, working code${language} for the given task. Return ONLY the code with no explanation.`;
      const r = await claudeApi('POST', '/messages', creds.api_key, { model: params.model || 'claude-sonnet-4-20250514', max_tokens: params.max_tokens || 4096, system, messages: [{ role: 'user', content: params.prompt }] });
      if (r.error) throw new Error(r.error.message);
      return { code: r.content?.[0]?.text, usage: r.usage };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
