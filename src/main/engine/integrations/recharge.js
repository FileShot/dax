/**
 * Recharge Subscriptions API Integration (Shopify/headless commerce)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function rcReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.rechargeapps.com', path, headers: { 'X-Recharge-Access-Token': creds.access_token, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'recharge',
  name: 'Recharge',
  category: 'billing',
  icon: 'CreditCard',
  description: 'Manage subscriptions, customers, and orders for Shopify stores with Recharge.',
  configFields: [{ key: 'access_token', label: 'Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rcReq('GET', '/subscriptions?limit=1', null, creds); return { success: true, message: `Connected — ${r.subscriptions?.length ?? 0} subscription(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_subscriptions: async (params, creds) => rcReq('GET', `/subscriptions?limit=${params.limit || 50}&status=${params.status || 'active'}`, null, creds),
    get_subscription: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return rcReq('GET', `/subscriptions/${params.id}`, null, creds);
    },
    list_customers: async (params, creds) => rcReq('GET', `/customers?limit=${params.limit || 50}`, null, creds),
    get_customer: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return rcReq('GET', `/customers/${params.id}`, null, creds);
    },
    list_orders: async (params, creds) => rcReq('GET', `/orders?limit=${params.limit || 50}&status=${params.status || 'success'}`, null, creds),
    list_charges: async (params, creds) => rcReq('GET', `/charges?limit=${params.limit || 50}&status=${params.charge_status || 'success'}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
