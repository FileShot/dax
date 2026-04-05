/**
 * Typeform API Integration
 */
'use strict';
const https = require('https');

function tfApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.typeform.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'typeform',
  name: 'Typeform',
  category: 'forms',
  icon: 'FileText',
  description: 'Build and analyze forms and surveys with Typeform.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tfApi('GET', '/me', creds.access_token); return { success: !!r.alias, message: `Connected as ${r.alias}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_forms: async (params, creds) => {
      const qs = new URLSearchParams({ page_size: params.page_size || 25, page: params.page || 1 });
      if (params.search) qs.set('search', params.search);
      return tfApi('GET', `/forms?${qs}`, creds.access_token);
    },
    get_form: async (params, creds) => { if (!params.form_id) throw new Error('form_id required'); return tfApi('GET', `/forms/${params.form_id}`, creds.access_token); },
    list_responses: async (params, creds) => {
      if (!params.form_id) throw new Error('form_id required');
      const qs = new URLSearchParams({ page_size: params.page_size || 25 });
      if (params.since) qs.set('since', params.since);
      if (params.until) qs.set('until', params.until);
      return tfApi('GET', `/forms/${params.form_id}/responses?${qs}`, creds.access_token);
    },
    get_response: async (params, creds) => {
      if (!params.form_id || !params.response_id) throw new Error('form_id and response_id required');
      return tfApi('GET', `/forms/${params.form_id}/responses?included_response_ids=${params.response_id}`, creds.access_token);
    },
    delete_responses: async (params, creds) => {
      if (!params.form_id || !params.included_tokens) throw new Error('form_id and included_tokens required');
      return tfApi('DELETE', `/forms/${params.form_id}/responses?included_tokens=${params.included_tokens}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
