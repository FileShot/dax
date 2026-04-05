/**
 * Google Cloud Translation API v2 Integration
 */
'use strict';
const https = require('https');

function googleTranslateRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const qs = `key=${encodeURIComponent(apiKey)}`;
    const url = `/language/translate/v2${path}?${qs}`;
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'translation.googleapis.com', path: url, headers: { 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'google-translate',
  name: 'Google Translate',
  category: 'translation',
  icon: 'Globe',
  description: 'Translate text and detect languages using Google Cloud Translation API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await googleTranslateRequest('GET', '/languages', null, creds.api_key); return { success: !!r.data?.languages, message: r.error ? r.error.message : 'Connected to Google Translate' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    translate: async (params, creds) => {
      if (!params.q || !params.target) throw new Error('q (text) and target language required');
      const body = { q: Array.isArray(params.q) ? params.q : [params.q], target: params.target, ...(params.source && { source: params.source }), ...(params.format && { format: params.format }), ...(params.model && { model: params.model }) };
      return googleTranslateRequest('POST', '', body, creds.api_key);
    },
    detect_language: async (params, creds) => {
      if (!params.q) throw new Error('q (text) required');
      const body = { q: Array.isArray(params.q) ? params.q : [params.q] };
      return googleTranslateRequest('POST', '/detect', body, creds.api_key);
    },
    list_languages: async (params, creds) => {
      const qs = params.target ? `&target=${encodeURIComponent(params.target)}` : '';
      return new Promise((resolve, reject) => {
        const url = `/language/translate/v2/languages?key=${encodeURIComponent(creds.api_key)}${qs}`;
        const opts = { method: 'GET', hostname: 'translation.googleapis.com', path: url };
        const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject);
        req.end();
      });
    },
    batch_translate: async (params, creds) => {
      if (!params.texts || !Array.isArray(params.texts) || !params.target) throw new Error('texts array and target required');
      const body = { q: params.texts, target: params.target, ...(params.source && { source: params.source }) };
      return googleTranslateRequest('POST', '', body, creds.api_key);
    },
    transliterate: async (params, creds) => {
      if (!params.q || !params.source || !params.target) throw new Error('q, source, and target required');
      const body = { q: params.q, source: params.source, target: params.target, format: 'text' };
      return googleTranslateRequest('POST', '', body, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
