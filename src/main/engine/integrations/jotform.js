/**
 * JotForm API Integration
 */
'use strict';
const https = require('https');

function jfApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method, hostname: 'api.jotform.com', path: `${path}${sep}apiKey=${apiKey}`, headers: { 'Content-Type': 'application/json' } };
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
  id: 'jotform',
  name: 'JotForm',
  category: 'forms',
  icon: 'ClipboardList',
  description: 'Create forms and manage submissions with JotForm.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await jfApi('GET', '/user', creds.api_key); return { success: r.responseCode === 200, message: `Connected as ${r.content?.username || 'user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_forms: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}&offset=${params.offset || 0}`;
      return jfApi('GET', `/user/forms${qs}`, creds.api_key);
    },
    get_form: async (params, creds) => { if (!params.form_id) throw new Error('form_id required'); return jfApi('GET', `/form/${params.form_id}`, creds.api_key); },
    list_submissions: async (params, creds) => {
      if (!params.form_id) throw new Error('form_id required');
      const qs = `?limit=${params.limit || 50}&offset=${params.offset || 0}`;
      return jfApi('GET', `/form/${params.form_id}/submissions${qs}`, creds.api_key);
    },
    get_submission: async (params, creds) => { if (!params.submission_id) throw new Error('submission_id required'); return jfApi('GET', `/submission/${params.submission_id}`, creds.api_key); },
    delete_submission: async (params, creds) => { if (!params.submission_id) throw new Error('submission_id required'); return jfApi('DELETE', `/submission/${params.submission_id}`, creds.api_key); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
