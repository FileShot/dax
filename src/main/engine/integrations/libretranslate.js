/**
 * LibreTranslate Self-Hosted Translation Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function libreRequest(method, path, body, host, port, apiKey, useHttps) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: host, port: parseInt(port) || (useHttps ? 443 : 80), path, headers: { 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const adapter = useHttps ? https : http;
    const req = adapter.request(opts, (res) => {
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
  id: 'libretranslate',
  name: 'LibreTranslate',
  category: 'translation',
  icon: 'BookOpen',
  description: 'Translate text using LibreTranslate self-hosted or public free/open translation API.',
  configFields: [
    { key: 'host', label: 'Host (e.g. libretranslate.com)', type: 'text', required: true },
    { key: 'port', label: 'Port (default 443)', type: 'text', required: false },
    { key: 'api_key', label: 'API Key (if required)', type: 'password', required: false },
    { key: 'use_https', label: 'Use HTTPS', type: 'select', options: ['true', 'false'], required: false },
  ],
  async connect(creds) { if (!creds.host) throw new Error('Host required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await libreRequest('GET', '/languages', null, creds.host, creds.port, creds.api_key, creds.use_https !== 'false'); return { success: Array.isArray(r), message: Array.isArray(r) ? `${r.length} languages available` : 'Connected to LibreTranslate' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    translate: async (params, creds) => {
      if (!params.q || !params.source || !params.target) throw new Error('q, source, and target required');
      const body = { q: params.q, source: params.source, target: params.target, format: params.format || 'text', ...(creds.api_key && { api_key: creds.api_key }) };
      return libreRequest('POST', '/translate', body, creds.host, creds.port, creds.api_key, creds.use_https !== 'false');
    },
    detect: async (params, creds) => {
      if (!params.q) throw new Error('q (text) required');
      const body = { q: params.q, ...(creds.api_key && { api_key: creds.api_key }) };
      return libreRequest('POST', '/detect', body, creds.host, creds.port, creds.api_key, creds.use_https !== 'false');
    },
    list_languages: async (params, creds) => {
      return libreRequest('GET', '/languages', null, creds.host, creds.port, creds.api_key, creds.use_https !== 'false');
    },
    get_language_pairs: async (params, creds) => {
      const langs = await libreRequest('GET', '/languages', null, creds.host, creds.port, creds.api_key, creds.use_https !== 'false');
      if (!Array.isArray(langs)) return langs;
      return { pairs: langs.flatMap(l => (l.targets || []).map(t => ({ source: l.code, target: t }))) };
    },
    translate_html: async (params, creds) => {
      if (!params.q || !params.source || !params.target) throw new Error('q, source, and target required');
      const body = { q: params.q, source: params.source, target: params.target, format: 'html', ...(creds.api_key && { api_key: creds.api_key }) };
      return libreRequest('POST', '/translate', body, creds.host, creds.port, creds.api_key, creds.use_https !== 'false');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
