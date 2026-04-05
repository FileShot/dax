/**
 * Paddle Billing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function paddleReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.sandbox ? 'sandbox-api.paddle.com' : 'api.paddle.com';
  const opts = { method, hostname: host, path, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'paddle',
  name: 'Paddle',
  category: 'billing',
  icon: 'CreditCard',
  description: 'Manage products, prices, subscriptions, and transactions with Paddle Billing.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'sandbox', label: 'Use Sandbox', type: 'boolean', required: false },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await paddleReq('GET', '/products?per_page=1', null, creds); return { success: true, message: `Connected — ${r.meta?.pagination?.total ?? 0} product(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => paddleReq('GET', `/products?per_page=${params.per_page || 20}&status=${params.status || 'active'}`, null, creds),
    get_product: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return paddleReq('GET', `/products/${params.id}`, null, creds);
    },
    list_prices: async (params, creds) => paddleReq('GET', `/prices?per_page=${params.per_page || 20}${params.product_id ? `&product_id=${params.product_id}` : ''}`, null, creds),
    list_subscriptions: async (params, creds) => paddleReq('GET', `/subscriptions?per_page=${params.per_page || 20}&status=${params.status || 'active'}`, null, creds),
    get_subscription: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return paddleReq('GET', `/subscriptions/${params.id}`, null, creds);
    },
    list_transactions: async (params, creds) => paddleReq('GET', `/transactions?per_page=${params.per_page || 20}&status=${params.status || 'completed'}`, null, creds),
    list_customers: async (params, creds) => paddleReq('GET', `/customers?per_page=${params.per_page || 20}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
