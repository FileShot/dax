/**
 * Lemon Squeezy Digital Commerce API Integration
 */
'use strict';
const https = require('https');

function lemonRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.lemonsqueezy.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'lemon-squeezy',
  name: 'Lemon Squeezy',
  category: 'ecommerce',
  icon: 'BadgeDollarSign',
  description: 'Manage products, orders, subscriptions, and licenses with Lemon Squeezy.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lemonRequest('GET', '/users/me', null, creds.api_key); return { success: !!r.data, message: r.errors?.[0]?.detail || `Connected — ${r.data?.attributes?.name || 'user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      const qs = params.store_id ? `?filter[store_id]=${params.store_id}` : '';
      return lemonRequest('GET', `/products${qs}`, null, creds.api_key);
    },
    get_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return lemonRequest('GET', `/products/${params.product_id}`, null, creds.api_key);
    },
    list_orders: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.store_id && { 'filter[store_id]': params.store_id }), ...(params.user_email && { 'filter[user_email]': params.user_email }) }).toString();
      return lemonRequest('GET', `/orders${qs ? `?${qs}` : ''}`, null, creds.api_key);
    },
    list_subscriptions: async (params, creds) => {
      const qs = params.store_id ? `?filter[store_id]=${params.store_id}` : '';
      return lemonRequest('GET', `/subscriptions${qs}`, null, creds.api_key);
    },
    list_stores: async (params, creds) => {
      return lemonRequest('GET', '/stores', null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
