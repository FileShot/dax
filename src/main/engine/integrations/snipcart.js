/**
 * Snipcart Headless Shopping Cart API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function snipcartReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname: 'app.snipcart.com', path: `/api${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'snipcart',
  name: 'Snipcart',
  category: 'billing',
  icon: 'ShoppingCart',
  description: 'Manage orders, customers, subscriptions, and discounts with Snipcart.',
  configFields: [{ key: 'api_key', label: 'Secret API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await snipcartReq('GET', '/orders?limit=1&offset=0', null, creds); return { success: true, message: `Connected — ${r.totalItems ?? 0} order(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_orders: async (params, creds) => snipcartReq('GET', `/orders?limit=${params.limit || 20}&offset=${params.offset || 0}&status=${params.status || 'processed'}`, null, creds),
    get_order: async (params, creds) => {
      if (!params.token) throw new Error('token required');
      return snipcartReq('GET', `/orders/${params.token}`, null, creds);
    },
    list_customers: async (params, creds) => snipcartReq('GET', `/customers?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    get_customer: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return snipcartReq('GET', `/customers/${params.id}`, null, creds);
    },
    list_subscriptions: async (params, creds) => snipcartReq('GET', `/subscriptions?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    list_discounts: async (params, creds) => snipcartReq('GET', `/discounts?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
