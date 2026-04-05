/**
 * PayPal REST API Integration
 */
'use strict';
const https = require('https');

function getPayPalToken(clientId, secret, sandbox) {
  return new Promise((resolve, reject) => {
    const hostname = sandbox ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const body = 'grant_type=client_credentials';
    const opts = { method: 'POST', hostname, path: '/v1/oauth2/token', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { const r = JSON.parse(data); resolve(r.access_token); } catch { reject(new Error('Token parse error')); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function paypalApi(method, path, token, sandbox, body = null) {
  return new Promise((resolve, reject) => {
    const hostname = sandbox ? 'api-m.sandbox.paypal.com' : 'api-m.paypal.com';
    const opts = { method, hostname, path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'paypal',
  name: 'PayPal',
  category: 'ecommerce',
  icon: 'CreditCard',
  description: 'Manage payments, orders, and payouts via PayPal REST API.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    { key: 'sandbox', label: 'Sandbox Mode', type: 'boolean', required: false },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('Client ID and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const token = await getPayPalToken(creds.client_id, creds.client_secret, creds.sandbox); return { success: !!token, message: token ? 'Connected to PayPal' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_payments: async (params, creds) => {
      const token = await getPayPalToken(creds.client_id, creds.client_secret, creds.sandbox);
      const count = params.limit || 10;
      return paypalApi('GET', `/v1/payments/payment?count=${count}`, token, creds.sandbox);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      const token = await getPayPalToken(creds.client_id, creds.client_secret, creds.sandbox);
      return paypalApi('GET', `/v2/checkout/orders/${params.order_id}`, token, creds.sandbox);
    },
    create_order: async (params, creds) => {
      if (!params.amount || !params.currency) throw new Error('amount and currency required');
      const token = await getPayPalToken(creds.client_id, creds.client_secret, creds.sandbox);
      return paypalApi('POST', '/v2/checkout/orders', token, creds.sandbox, { intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: params.currency, value: String(params.amount) } }] });
    },
    list_transactions: async (params, creds) => {
      const token = await getPayPalToken(creds.client_id, creds.client_secret, creds.sandbox);
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString();
      const end = params.end_date || new Date().toISOString();
      return paypalApi('GET', `/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=${params.limit || 20}`, token, creds.sandbox);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
