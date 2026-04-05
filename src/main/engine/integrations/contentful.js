/**
 * Contentful Content Management API Integration
 */
'use strict';
const https = require('https');

function contentfulApi(method, hostname, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'contentful',
  name: 'Contentful',
  category: 'cms',
  icon: 'Layout',
  description: 'Manage content entries, assets, and spaces in Contentful.',
  configFields: [
    { key: 'access_token', label: 'Management API Token', type: 'password', required: true },
    { key: 'space_id', label: 'Space ID', type: 'text', required: true },
    { key: 'environment', label: 'Environment', type: 'text', required: false, placeholder: 'master' },
  ],
  async connect(creds) { if (!creds.access_token || !creds.space_id) throw new Error('Access token and space ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await contentfulApi('GET', 'api.contentful.com', `/spaces/${creds.space_id}`, creds.access_token); return { success: !!r.sys, message: r.name ? `Space: ${r.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_entries: async (params, creds) => {
      const env = creds.environment || 'master';
      const ct = params.content_type ? `&content_type=${params.content_type}` : '';
      return contentfulApi('GET', 'api.contentful.com', `/spaces/${creds.space_id}/environments/${env}/entries?limit=${params.limit || 20}${ct}`, creds.access_token);
    },
    get_entry: async (params, creds) => { if (!params.entry_id) throw new Error('entry_id required'); const env = creds.environment || 'master'; return contentfulApi('GET', 'api.contentful.com', `/spaces/${creds.space_id}/environments/${env}/entries/${params.entry_id}`, creds.access_token); },
    create_entry: async (params, creds) => {
      if (!params.content_type || !params.fields) throw new Error('content_type and fields required');
      const env = creds.environment || 'master';
      return new Promise((resolve, reject) => {
        const opts = { method: 'POST', hostname: 'api.contentful.com', path: `/spaces/${creds.space_id}/environments/${env}/entries`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/vnd.contentful.management.v1+json', 'X-Contentful-Content-Type': params.content_type } };
        const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject);
        req.write(JSON.stringify({ fields: params.fields }));
        req.end();
      });
    },
    list_content_types: async (params, creds) => { const env = creds.environment || 'master'; return contentfulApi('GET', 'api.contentful.com', `/spaces/${creds.space_id}/environments/${env}/content_types`, creds.access_token); },
    list_assets: async (params, creds) => { const env = creds.environment || 'master'; return contentfulApi('GET', 'api.contentful.com', `/spaces/${creds.space_id}/environments/${env}/assets?limit=${params.limit || 20}`, creds.access_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
