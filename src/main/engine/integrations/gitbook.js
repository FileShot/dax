/**
 * GitBook API Integration
 */
'use strict';
const https = require('https');

function gbApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.gitbook.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'gitbook',
  name: 'GitBook',
  category: 'documentation',
  icon: 'BookMarked',
  description: 'Manage documentation spaces and content in GitBook.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gbApi('GET', '/user', creds.api_token); return { success: !!r.id, message: `Connected as ${r.displayName}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_organizations: async (params, creds) => gbApi('GET', '/orgs', creds.api_token),
    list_spaces: async (params, creds) => {
      if (!params.org_id) throw new Error('org_id required');
      return gbApi('GET', `/orgs/${params.org_id}/spaces`, creds.api_token);
    },
    get_space: async (params, creds) => { if (!params.space_id) throw new Error('space_id required'); return gbApi('GET', `/spaces/${params.space_id}`, creds.api_token); },
    search_content: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query });
      if (params.space_id) qs.set('spaceId', params.space_id);
      return gbApi('GET', `/search?${qs}`, creds.api_token);
    },
    get_page_by_path: async (params, creds) => {
      if (!params.space_id || !params.path) throw new Error('space_id and path required');
      return gbApi('GET', `/spaces/${params.space_id}/content/path/${encodeURIComponent(params.path)}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
