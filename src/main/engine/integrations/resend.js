/**
 * Resend Email API Integration
 */
'use strict';
const https = require('https');

function resendApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.resend.com', path, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } };
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
  id: 'resend',
  name: 'Resend',
  category: 'email-marketing',
  icon: 'SendHorizonal',
  description: 'Send transactional emails and manage templates with Resend.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await resendApi('GET', '/domains', creds.api_key); return { success: Array.isArray(r.data), message: `${(r.data || []).length} domain(s) configured` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_email: async (params, creds) => {
      if (!params.from || !params.to || !params.subject || (!params.html && !params.text)) throw new Error('from, to, subject, and html or text required');
      const body = { from: params.from, to: Array.isArray(params.to) ? params.to : [params.to], subject: params.subject };
      if (params.html) body.html = params.html;
      if (params.text) body.text = params.text;
      if (params.reply_to) body.reply_to = params.reply_to;
      return resendApi('POST', '/emails', creds.api_key, body);
    },
    get_email: async (params, creds) => { if (!params.email_id) throw new Error('email_id required'); return resendApi('GET', `/emails/${params.email_id}`, creds.api_key); },
    list_domains: async (params, creds) => resendApi('GET', '/domains', creds.api_key),
    add_domain: async (params, creds) => { if (!params.name) throw new Error('name required'); return resendApi('POST', '/domains', creds.api_key, { name: params.name }); },
    list_api_keys: async (params, creds) => resendApi('GET', '/api-keys', creds.api_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
