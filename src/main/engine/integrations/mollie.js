/**
 * Mollie Payments API Integration
 */
'use strict';
const https = require('https');

function mollieApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.mollie.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } };
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
  id: 'mollie',
  name: 'Mollie',
  category: 'payments',
  icon: 'Banknote',
  description: 'Create and manage payments, refunds, and subscriptions with Mollie.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mollieApi('GET', '/profile/me', creds.api_key); return { success: !!r.id, message: `Connected as ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_payment: async (params, creds) => {
      if (!params.amount || !params.currency || !params.description || !params.redirect_url) throw new Error('amount, currency, description, and redirect_url required');
      return mollieApi('POST', '/payments', creds.api_key, { amount: { currency: params.currency, value: String(Number(params.amount).toFixed(2)) }, description: params.description, redirectUrl: params.redirect_url, method: params.method });
    },
    get_payment: async (params, creds) => { if (!params.payment_id) throw new Error('payment_id required'); return mollieApi('GET', `/payments/${params.payment_id}`, creds.api_key); },
    list_payments: async (params, creds) => {
      const qs = `?limit=${params.limit || 25}`;
      return mollieApi('GET', `/payments${qs}`, creds.api_key);
    },
    create_refund: async (params, creds) => {
      if (!params.payment_id || !params.amount || !params.currency) throw new Error('payment_id, amount, and currency required');
      return mollieApi('POST', `/payments/${params.payment_id}/refunds`, creds.api_key, { amount: { currency: params.currency, value: String(Number(params.amount).toFixed(2)) }, description: params.description || '' });
    },
    list_methods: async (params, creds) => {
      const qs = params.include ? `?include=${params.include}` : '';
      return mollieApi('GET', `/methods${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
