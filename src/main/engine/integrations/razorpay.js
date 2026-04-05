/**
 * Razorpay API Integration
 */
'use strict';
const https = require('https');

function razorpayApi(method, path, keyId, keySecret, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const opts = { method, hostname: 'api.razorpay.com', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'razorpay',
  name: 'Razorpay',
  category: 'payments',
  icon: 'IndianRupee',
  description: 'Create and manage orders, payments, and refunds with Razorpay.',
  configFields: [
    { key: 'key_id', label: 'Key ID', type: 'text', required: true },
    { key: 'key_secret', label: 'Key Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.key_id || !creds.key_secret) throw new Error('Key ID and key secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await razorpayApi('GET', '/payments?count=1', creds.key_id, creds.key_secret); return { success: Array.isArray(r.items), message: `${r.count || 0} total payment(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_order: async (params, creds) => {
      if (!params.amount || !params.currency) throw new Error('amount (in paise) and currency required');
      return razorpayApi('POST', '/orders', creds.key_id, creds.key_secret, { amount: params.amount, currency: params.currency, receipt: params.receipt || `receipt-${Date.now()}`, notes: params.notes || {} });
    },
    get_order: async (params, creds) => { if (!params.order_id) throw new Error('order_id required'); return razorpayApi('GET', `/orders/${params.order_id}`, creds.key_id, creds.key_secret); },
    list_payments: async (params, creds) => {
      const qs = `?count=${params.count || 25}&skip=${params.skip || 0}`;
      return razorpayApi('GET', `/payments${qs}`, creds.key_id, creds.key_secret);
    },
    refund_payment: async (params, creds) => {
      if (!params.payment_id || !params.amount) throw new Error('payment_id and amount required');
      return razorpayApi('POST', `/payments/${params.payment_id}/refund`, creds.key_id, creds.key_secret, { amount: params.amount, notes: params.notes || {} });
    },
    capture_payment: async (params, creds) => {
      if (!params.payment_id || !params.amount || !params.currency) throw new Error('payment_id, amount, and currency required');
      return razorpayApi('POST', `/payments/${params.payment_id}/capture`, creds.key_id, creds.key_secret, { amount: params.amount, currency: params.currency });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
