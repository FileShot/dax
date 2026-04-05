/**
 * Stripe Connect API Integration
 */
'use strict';
const https = require('https');

function stripeRequest(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const bodyStr = body ? new URLSearchParams(Object.entries(body).reduce((acc, [k, v]) => { acc[k] = String(v); return acc; }, {})).toString() : null;
    const opts = { method, hostname: 'api.stripe.com', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'stripe-connect',
  name: 'Stripe Connect',
  category: 'payments',
  icon: 'CreditCard',
  description: 'Manage connected accounts, transfers, and payouts via Stripe Connect.',
  configFields: [
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.secret_key) throw new Error('Secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await stripeRequest('GET', '/accounts?limit=1', creds.secret_key); return { success: Array.isArray(r.data), message: `${r.data?.length || 0} connected account(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_accounts: async (params, creds) => {
      const qs = `?limit=${params.limit || 25}`;
      return stripeRequest('GET', `/accounts${qs}`, creds.secret_key);
    },
    get_account: async (params, creds) => { if (!params.account_id) throw new Error('account_id required'); return stripeRequest('GET', `/accounts/${params.account_id}`, creds.secret_key); },
    create_account: async (params, creds) => {
      if (!params.type || !params.country || !params.email) throw new Error('type, country, and email required');
      return stripeRequest('POST', '/accounts', creds.secret_key, { type: params.type, country: params.country, email: params.email });
    },
    list_transfers: async (params, creds) => {
      const qs = `?limit=${params.limit || 25}${params.destination ? `&destination=${params.destination}` : ''}`;
      return stripeRequest('GET', `/transfers${qs}`, creds.secret_key);
    },
    create_transfer: async (params, creds) => {
      if (!params.amount || !params.currency || !params.destination) throw new Error('amount, currency, and destination required');
      return stripeRequest('POST', '/transfers', creds.secret_key, { amount: params.amount, currency: params.currency, destination: params.destination });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
