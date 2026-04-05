/**
 * ConvertKit API Integration
 */
'use strict';
const https = require('https');

function ckApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method, hostname: 'api.convertkit.com', path: `/v3${path}${sep}api_key=${apiKey}`, headers: { 'Content-Type': 'application/json' } };
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

function ckApiSecret(method, path, apiSecret, body = null) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify({ ...body, api_secret: apiSecret }) : JSON.stringify({ api_secret: apiSecret });
    const opts = { method, hostname: 'api.convertkit.com', path: `/v3${path}`, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(b);
    req.end();
  });
}

module.exports = {
  id: 'convertkit',
  name: 'ConvertKit',
  category: 'email-marketing',
  icon: 'Send',
  description: 'Manage subscribers, forms, and sequences with ConvertKit.',
  configFields: [
    { key: 'api_key', label: 'API Key (public)', type: 'text', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.api_secret) throw new Error('API key and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ckApiSecret('GET', '/account', creds.api_secret); return { success: !!r.primary_email_address, message: `Connected as ${r.primary_email_address}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_forms: async (params, creds) => ckApi('GET', '/forms', creds.api_key),
    list_sequences: async (params, creds) => ckApi('GET', '/sequences', creds.api_key),
    list_subscribers: async (params, creds) => {
      const qs = new URLSearchParams({ page: params.page || 1 });
      return ckApiSecret('GET', `/subscribers?${qs}`, creds.api_secret);
    },
    add_subscriber_to_form: async (params, creds) => {
      if (!params.form_id || !params.email) throw new Error('form_id and email required');
      return ckApiSecret('POST', `/forms/${params.form_id}/subscribe`, creds.api_secret, { email: params.email, first_name: params.first_name || '' });
    },
    unsubscribe: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return ckApiSecret('PUT', '/unsubscribe', creds.api_secret, { email: params.email });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
