/**
 * Strapi Headless CMS Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function strapiApi(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `/api${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'strapi',
  name: 'Strapi',
  category: 'cms',
  icon: 'Server',
  description: 'Manage content in Strapi headless CMS.',
  configFields: [
    { key: 'base_url', label: 'Strapi URL', type: 'text', required: true, placeholder: 'http://localhost:1337' },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.base_url || !creds.api_token) throw new Error('Base URL and API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await strapiApi('GET', creds.base_url, '/users/me', creds.api_token); return { success: !!r.id || !!r.data, message: 'Connected to Strapi' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_entries: async (params, creds) => {
      if (!params.collection) throw new Error('collection name required');
      const pagination = `?pagination[pageSize]=${params.limit || 25}&pagination[page]=${params.page || 1}`;
      return strapiApi('GET', creds.base_url, `/${params.collection}${pagination}`, creds.api_token);
    },
    get_entry: async (params, creds) => { if (!params.collection || !params.entry_id) throw new Error('collection and entry_id required'); return strapiApi('GET', creds.base_url, `/${params.collection}/${params.entry_id}`, creds.api_token); },
    create_entry: async (params, creds) => { if (!params.collection || !params.data) throw new Error('collection and data required'); return strapiApi('POST', creds.base_url, `/${params.collection}`, creds.api_token, { data: params.data }); },
    update_entry: async (params, creds) => { if (!params.collection || !params.entry_id || !params.data) throw new Error('collection, entry_id, and data required'); return strapiApi('PUT', creds.base_url, `/${params.collection}/${params.entry_id}`, creds.api_token, { data: params.data }); },
    delete_entry: async (params, creds) => { if (!params.collection || !params.entry_id) throw new Error('collection and entry_id required'); return strapiApi('DELETE', creds.base_url, `/${params.collection}/${params.entry_id}`, creds.api_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
