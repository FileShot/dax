/**
 * Tally Forms API Integration
 */
'use strict';
const https = require('https');

function tallyApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.tally.so', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'tally',
  name: 'Tally',
  category: 'forms',
  icon: 'FormInput',
  description: 'Build free forms and collect responses with Tally.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tallyApi('GET', '/me', creds.access_token); return { success: !!r.id, message: 'Connected to Tally' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_forms: async (params, creds) => {
      const qs = new URLSearchParams({ page: params.page || 1, limit: params.limit || 20 });
      return tallyApi('GET', `/forms?${qs}`, creds.access_token);
    },
    get_form: async (params, creds) => { if (!params.form_id) throw new Error('form_id required'); return tallyApi('GET', `/forms/${params.form_id}`, creds.access_token); },
    list_submissions: async (params, creds) => {
      if (!params.form_id) throw new Error('form_id required');
      const qs = new URLSearchParams({ page: params.page || 1, limit: params.limit || 50 });
      return tallyApi('GET', `/forms/${params.form_id}/submissions?${qs}`, creds.access_token);
    },
    get_submission: async (params, creds) => {
      if (!params.form_id || !params.submission_id) throw new Error('form_id and submission_id required');
      return tallyApi('GET', `/forms/${params.form_id}/submissions/${params.submission_id}`, creds.access_token);
    },
    delete_submission: async (params, creds) => {
      if (!params.form_id || !params.submission_id) throw new Error('form_id and submission_id required');
      return tallyApi('DELETE', `/forms/${params.form_id}/submissions/${params.submission_id}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
