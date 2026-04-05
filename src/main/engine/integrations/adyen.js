/**
 * Adyen Checkout API Integration
 */
'use strict';
const https = require('https');

function adyenApi(method, path, apiKey, environment, body = null) {
  const hostname = environment === 'live' ? 'checkout-live.adyen.com' : 'checkout-test.adyen.com';
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path: `/v71${path}`, headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' } };
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
  id: 'adyen',
  name: 'Adyen',
  category: 'payments',
  icon: 'DollarSign',
  description: 'Process payments and manage transactions with Adyen.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'merchant_account', label: 'Merchant Account', type: 'text', required: true },
    { key: 'environment', label: 'Environment', type: 'select', options: ['test', 'live'], required: false },
  ],
  async connect(creds) { if (!creds.api_key || !creds.merchant_account) throw new Error('API key and merchant account required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await adyenApi('POST', '/paymentMethods', creds.api_key, creds.environment || 'test', { merchantAccount: creds.merchant_account }); return { success: Array.isArray(r.paymentMethods), message: `${r.paymentMethods?.length || 0} payment method(s) available` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_payment_methods: async (params, creds) => adyenApi('POST', '/paymentMethods', creds.api_key, creds.environment || 'test', { merchantAccount: creds.merchant_account, amount: { currency: params.currency || 'USD', value: params.amount || 1000 }, countryCode: params.country_code || 'US' }),
    create_payment_session: async (params, creds) => {
      if (!params.amount || !params.currency || !params.return_url) throw new Error('amount, currency, and return_url required');
      return adyenApi('POST', '/sessions', creds.api_key, creds.environment || 'test', { merchantAccount: creds.merchant_account, amount: { value: params.amount, currency: params.currency }, returnUrl: params.return_url, reference: params.reference || `order-${Date.now()}` });
    },
    get_payment_result: async (params, creds) => { if (!params.payment_data) throw new Error('payment_data required'); return adyenApi('POST', '/payments/result', creds.api_key, creds.environment || 'test', { paymentData: params.payment_data, details: params.details || {} }); },
    create_refund: async (params, creds) => {
      if (!params.psp_reference || !params.amount || !params.currency) throw new Error('psp_reference, amount, and currency required');
      return adyenApi('POST', '/payments/refunds', creds.api_key, creds.environment || 'test', { merchantAccount: creds.merchant_account, amount: { value: params.amount, currency: params.currency }, paymentPspReference: params.psp_reference });
    },
    get_payment_links: async (params, creds) => {
      if (!params.amount || !params.currency) throw new Error('amount and currency required');
      return adyenApi('POST', '/paymentLinks', creds.api_key, creds.environment || 'test', { merchantAccount: creds.merchant_account, amount: { value: params.amount, currency: params.currency }, reference: params.reference || `link-${Date.now()}` });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
