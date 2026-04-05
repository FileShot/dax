/**
 * Meilisearch API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function meiliApi(method, baseUrl, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 7700), path, headers };
    const req = mod.request(opts, (res) => {
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
  id: 'meilisearch',
  name: 'Meilisearch',
  category: 'search',
  icon: 'Search',
  description: 'Manage indices and search in Meilisearch.',
  configFields: [
    { key: 'base_url', label: 'Meilisearch URL', type: 'text', required: true, placeholder: 'http://localhost:7700' },
    { key: 'api_key', label: 'API Key (Master/Admin)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.base_url) throw new Error('Meilisearch URL required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await meiliApi('GET', creds.base_url, '/health', creds.api_key); return { success: r.status === 'available', message: r.status === 'available' ? 'Connected to Meilisearch' : 'Not available' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.index || !params.query) throw new Error('index and query required');
      return meiliApi('POST', creds.base_url, `/indexes/${encodeURIComponent(params.index)}/search`, creds.api_key, { q: params.query, limit: params.limit || 20, offset: params.offset || 0 });
    },
    list_indexes: async (params, creds) => meiliApi('GET', creds.base_url, `/indexes?limit=${params.limit || 20}`, creds.api_key),
    create_index: async (params, creds) => {
      if (!params.uid) throw new Error('uid required');
      return meiliApi('POST', creds.base_url, '/indexes', creds.api_key, { uid: params.uid, primaryKey: params.primary_key });
    },
    add_documents: async (params, creds) => {
      if (!params.index || !params.documents) throw new Error('index and documents required');
      return meiliApi('POST', creds.base_url, `/indexes/${encodeURIComponent(params.index)}/documents`, creds.api_key, params.documents);
    },
    get_stats: async (params, creds) => meiliApi('GET', creds.base_url, '/stats', creds.api_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
