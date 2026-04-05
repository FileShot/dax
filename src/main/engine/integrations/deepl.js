/**
 * DeepL Translation API Integration
 */
'use strict';
const https = require('https');

function deeplRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const isFree = apiKey.endsWith(':fx');
    const hostname = isFree ? 'api-free.deepl.com' : 'api.deepl.com';
    const bodyStr = body ? new URLSearchParams(body).toString() : null;
    const opts = { method, hostname, path: `/v2${path}`, headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'deepl',
  name: 'DeepL',
  category: 'translation',
  icon: 'Languages',
  description: 'Translate text and documents with DeepL high-quality neural machine translation.',
  configFields: [
    { key: 'api_key', label: 'Authentication Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('Authentication key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await deeplRequest('GET', '/usage', null, creds.api_key); return { success: r.character_count !== undefined, message: `Connected to DeepL — ${r.character_count || 0} chars used` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    translate_text: async (params, creds) => {
      if (!params.text || !params.target_lang) throw new Error('text and target_lang required');
      const texts = Array.isArray(params.text) ? params.text : [params.text];
      const formData = { target_lang: params.target_lang.toUpperCase(), ...(params.source_lang && { source_lang: params.source_lang.toUpperCase() }), ...(params.formality && { formality: params.formality }), ...(params.glossary_id && { glossary_id: params.glossary_id }) };
      // DeepL accepts multiple text[] params
      const qs = texts.map(t => `text=${encodeURIComponent(t)}`).join('&') + '&' + new URLSearchParams(formData).toString();
      return new Promise((resolve, reject) => {
        const isFree = creds.api_key.endsWith(':fx');
        const hostname = isFree ? 'api-free.deepl.com' : 'api.deepl.com';
        const opts = { method: 'POST', hostname, path: '/v2/translate', headers: { 'Authorization': `DeepL-Auth-Key ${creds.api_key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(qs) } };
        const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject);
        req.write(qs);
        req.end();
      });
    },
    detect_language: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const qs = `text=${encodeURIComponent(params.text)}&target_lang=EN`;
      return new Promise((resolve, reject) => {
        const isFree = creds.api_key.endsWith(':fx');
        const hostname = isFree ? 'api-free.deepl.com' : 'api.deepl.com';
        const opts = { method: 'POST', hostname, path: '/v2/translate', headers: { 'Authorization': `DeepL-Auth-Key ${creds.api_key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(qs) } };
        const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { const parsed = JSON.parse(d); resolve({ detected_source_language: parsed.translations?.[0]?.detected_source_language }); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject);
        req.write(qs);
        req.end();
      });
    },
    list_languages: async (params, creds) => {
      const type = params.type === 'source' ? '?type=source' : '?type=target';
      return deeplRequest('GET', `/languages${type}`, null, creds.api_key);
    },
    get_usage: async (params, creds) => {
      return deeplRequest('GET', '/usage', null, creds.api_key);
    },
    list_glossaries: async (params, creds) => {
      return deeplRequest('GET', '/glossaries', null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
