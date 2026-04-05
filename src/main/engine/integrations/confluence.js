/**
 * Confluence (Atlassian) API Integration
 */
'use strict';
const https = require('https');

function cfApi(method, path, email, token, cloudId, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    const opts = { method, hostname: 'api.atlassian.com', path: `/ex/confluence/${cloudId}/wiki/rest/api${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'confluence',
  name: 'Confluence',
  category: 'documentation',
  icon: 'BookOpen',
  description: 'Manage spaces, pages, and content in Atlassian Confluence.',
  configFields: [
    { key: 'email', label: 'Atlassian Email', type: 'text', required: true },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'cloud_id', label: 'Cloud ID', type: 'text', required: true, description: 'Your Confluence Cloud ID' },
  ],
  async connect(creds) { if (!creds.email || !creds.api_token || !creds.cloud_id) throw new Error('Email, API token, and cloud ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cfApi('GET', '/space?limit=1', creds.email, creds.api_token, creds.cloud_id); return { success: !!r.results, message: 'Connected to Confluence' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_spaces: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 25, start: params.start || 0 });
      return cfApi('GET', `/space?${qs}`, creds.email, creds.api_token, creds.cloud_id);
    },
    get_page: async (params, creds) => { if (!params.page_id) throw new Error('page_id required'); return cfApi('GET', `/content/${params.page_id}?expand=body.storage`, creds.email, creds.api_token, creds.cloud_id); },
    create_page: async (params, creds) => {
      if (!params.space_key || !params.title || !params.content) throw new Error('space_key, title, and content required');
      const body = { type: 'page', title: params.title, space: { key: params.space_key }, body: { storage: { value: params.content, representation: 'storage' } } };
      if (params.parent_id) body.ancestors = [{ id: params.parent_id }];
      return cfApi('POST', '/content', creds.email, creds.api_token, creds.cloud_id, body);
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ cql: params.query, limit: params.limit || 25 });
      return cfApi('GET', `/search?${qs}`, creds.email, creds.api_token, creds.cloud_id);
    },
    update_page: async (params, creds) => {
      if (!params.page_id || !params.title || !params.content || !params.version) throw new Error('page_id, title, content, and version required');
      const body = { type: 'page', title: params.title, version: { number: params.version }, body: { storage: { value: params.content, representation: 'storage' } } };
      return cfApi('PUT', `/content/${params.page_id}`, creds.email, creds.api_token, creds.cloud_id, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
