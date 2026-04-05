/**
 * Mailgun API Integration
 */
'use strict';
const https = require('https');

function mgApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const opts = { method, hostname: 'api.mailgun.net', path: `/v3${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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

function mgApiForm(method, path, apiKey, params) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const body = new URLSearchParams(params).toString();
    const opts = { method, hostname: 'api.mailgun.net', path: `/v3${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'mailgun',
  name: 'Mailgun',
  category: 'email-marketing',
  icon: 'Zap',
  description: 'Send transactional emails and manage domains with Mailgun.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'domain', label: 'Sending Domain', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.domain) throw new Error('API key and domain required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mgApi('GET', `/domains/${creds.domain}`, creds.api_key); return { success: !!r.domain, message: `Domain ${r.domain?.name} active` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_email: async (params, creds) => {
      if (!params.to || !params.subject || (!params.text && !params.html)) throw new Error('to, subject, and text or html required');
      const body = { from: params.from || `noreply@${creds.domain}`, to: params.to, subject: params.subject };
      if (params.text) body.text = params.text;
      if (params.html) body.html = params.html;
      return mgApiForm('POST', `/${creds.domain}/messages`, creds.api_key, body);
    },
    list_domains: async (params, creds) => mgApi('GET', '/domains', creds.api_key),
    get_logs: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 25, event: params.event || 'accepted' });
      return mgApi('GET', `/${creds.domain}/log?${qs}`, creds.api_key);
    },
    get_stats: async (params, creds) => {
      const qs = new URLSearchParams({ event: ['accepted', 'delivered', 'failed', 'opened', 'clicked'], duration: params.duration || '7d' });
      return mgApi('GET', `/${creds.domain}/stats/total?${qs}`, creds.api_key);
    },
    validate_email: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return mgApi('GET', `/address/validate?address=${encodeURIComponent(params.address)}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
