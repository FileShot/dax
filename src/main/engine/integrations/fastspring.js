/**
 * FastSpring eCommerce API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fsReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  const opts = { method, hostname: 'api.fastspring.com', path, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'fastspring',
  name: 'FastSpring',
  category: 'billing',
  icon: 'ShoppingCart',
  description: 'Manage products, accounts, orders, and subscriptions with FastSpring eCommerce.',
  configFields: [
    { key: 'username', label: 'API Username', type: 'string', required: true },
    { key: 'password', label: 'API Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.username || !creds.password) throw new Error('username and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fsReq('GET', '/products', null, creds); return { success: true, message: `Connected — ${r.products?.length ?? 0} product(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => fsReq('GET', '/products', null, creds),
    get_product: async (params, creds) => {
      if (!params.product_path) throw new Error('product_path required');
      return fsReq('GET', `/products/${encodeURIComponent(params.product_path)}`, null, creds);
    },
    list_accounts: async (params, creds) => fsReq('GET', `/accounts?limit=${params.limit || 20}&page=${params.page || 0}`, null, creds),
    get_account: async (params, creds) => {
      if (!params.account_id) throw new Error('account_id required');
      return fsReq('GET', `/accounts/${params.account_id}`, null, creds);
    },
    list_subscriptions: async (params, creds) => {
      if (!params.account_id) throw new Error('account_id required');
      return fsReq('GET', `/subscriptions/${params.account_id}`, null, creds);
    },
    get_order: async (params, creds) => {
      if (!params.order_ref) throw new Error('order_ref required');
      return fsReq('GET', `/orders/${params.order_ref}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
