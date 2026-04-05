/**
 * ReadMe.io API Integration
 */
'use strict';
const https = require('https');

function readmeApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const opts = { method, hostname: 'dash.readme.com', path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'x-readme-version': 'v2' } };
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
  id: 'readme-io',
  name: 'ReadMe',
  category: 'documentation',
  icon: 'FileCode',
  description: 'Manage API documentation and developer hubs with ReadMe.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await readmeApi('GET', '/project', creds.api_key); return { success: !!r.name, message: `Connected to ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_docs: async (params, creds) => readmeApi('GET', '/docs', creds.api_key),
    get_doc: async (params, creds) => { if (!params.slug) throw new Error('slug required'); return readmeApi('GET', `/docs/${params.slug}`, creds.api_key); },
    create_doc: async (params, creds) => {
      if (!params.title || !params.category) throw new Error('title and category required');
      return readmeApi('POST', '/docs', creds.api_key, { title: params.title, category: params.category, body: params.body || '', hidden: params.hidden !== false });
    },
    update_doc: async (params, creds) => {
      if (!params.slug || !params.title) throw new Error('slug and title required');
      return readmeApi('PUT', `/docs/${params.slug}`, creds.api_key, { title: params.title, body: params.body || '', hidden: params.hidden !== false });
    },
    list_categories: async (params, creds) => {
      const qs = new URLSearchParams({ perPage: params.per_page || 20, page: params.page || 1 });
      return readmeApi('GET', `/categories?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
