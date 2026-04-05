/**
 * Brevo (formerly Sendinblue) API Integration
 */
'use strict';
const https = require('https');

function brevoApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.brevo.com', path: `/v3${path}`, headers: { 'api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'brevo',
  name: 'Brevo',
  category: 'email-marketing',
  icon: 'MailOpen',
  description: 'Send transactional and marketing emails via Brevo.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await brevoApi('GET', '/account', creds.api_key); return { success: !!r.email, message: `Connected as ${r.email}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_email: async (params, creds) => {
      if (!params.to || !params.subject || !params.html_content) throw new Error('to, subject, and html_content required');
      const body = { sender: { email: params.from_email || 'noreply@example.com', name: params.from_name || 'Dax' }, to: [{ email: params.to }], subject: params.subject, htmlContent: params.html_content };
      return brevoApi('POST', '/smtp/email', creds.api_key, body);
    },
    list_contacts: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 50, offset: params.offset || 0 });
      return brevoApi('GET', `/contacts?${qs}`, creds.api_key);
    },
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return brevoApi('POST', '/contacts', creds.api_key, { email: params.email, attributes: params.attributes || {}, listIds: params.list_ids || [] });
    },
    list_campaigns: async (params, creds) => {
      const qs = new URLSearchParams({ type: params.type || 'email', status: params.status || 'sent', limit: params.limit || 25 });
      return brevoApi('GET', `/emailCampaigns?${qs}`, creds.api_key);
    },
    get_campaign_stats: async (params, creds) => { if (!params.campaign_id) throw new Error('campaign_id required'); return brevoApi('GET', `/emailCampaigns/${params.campaign_id}`, creds.api_key); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
