/**
 * Google Forms API Integration
 */
'use strict';
const https = require('https');

function gfApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'forms.googleapis.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'google-forms',
  name: 'Google Forms',
  category: 'forms',
  icon: 'FileCheck',
  description: 'Create and manage Google Forms and responses.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { if (!creds.access_token) throw new Error('No token'); return { success: true, message: 'Token configured' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_form: async (params, creds) => { if (!params.form_id) throw new Error('form_id required'); return gfApi('GET', `/forms/${params.form_id}`, creds.access_token); },
    list_responses: async (params, creds) => {
      if (!params.form_id) throw new Error('form_id required');
      const qs = params.page_token ? `?pageToken=${encodeURIComponent(params.page_token)}` : '';
      return gfApi('GET', `/forms/${params.form_id}/responses${qs}`, creds.access_token);
    },
    get_response: async (params, creds) => {
      if (!params.form_id || !params.response_id) throw new Error('form_id and response_id required');
      return gfApi('GET', `/forms/${params.form_id}/responses/${params.response_id}`, creds.access_token);
    },
    create_form: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return gfApi('POST', '/forms', creds.access_token, { info: { title: params.title, documentTitle: params.document_title || params.title } });
    },
    batch_update_form: async (params, creds) => {
      if (!params.form_id || !params.requests) throw new Error('form_id and requests required');
      return gfApi('POST', `/forms/${params.form_id}:batchUpdate`, creds.access_token, { requests: params.requests });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
