/**
 * Algolia Search API Integration
 */
'use strict';
const https = require('https');

function algoliaApi(method, appId, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `${appId}-dsn.algolia.net`, path: `/1${path}`, headers: { 'X-Algolia-Application-Id': appId, 'X-Algolia-API-Key': apiKey, 'Content-Type': 'application/json' } };
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
  id: 'algolia',
  name: 'Algolia',
  category: 'search',
  icon: 'Search',
  description: 'Manage search indices and perform queries with Algolia.',
  configFields: [
    { key: 'app_id', label: 'Application ID', type: 'text', required: true },
    { key: 'api_key', label: 'Admin API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.api_key) throw new Error('Application ID and API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await algoliaApi('GET', creds.app_id, '/indexes', creds.api_key); return { success: !!r.items, message: r.items ? `${r.items.length} index(es) found` : 'Connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.index || !params.query) throw new Error('index and query required');
      return algoliaApi('POST', creds.app_id, `/indexes/${encodeURIComponent(params.index)}/query`, creds.api_key, { query: params.query, hitsPerPage: params.limit || 20 });
    },
    list_indices: async (params, creds) => algoliaApi('GET', creds.app_id, '/indexes', creds.api_key),
    add_object: async (params, creds) => {
      if (!params.index || !params.object) throw new Error('index and object required');
      return algoliaApi('POST', creds.app_id, `/indexes/${encodeURIComponent(params.index)}`, creds.api_key, params.object);
    },
    delete_object: async (params, creds) => {
      if (!params.index || !params.object_id) throw new Error('index and object_id required');
      return algoliaApi('DELETE', creds.app_id, `/indexes/${encodeURIComponent(params.index)}/${encodeURIComponent(params.object_id)}`, creds.api_key);
    },
    get_settings: async (params, creds) => {
      if (!params.index) throw new Error('index required');
      return algoliaApi('GET', creds.app_id, `/indexes/${encodeURIComponent(params.index)}/settings`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
