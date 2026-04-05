/**
 * Chargebee Subscription Billing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function cbReq(method, path, body, creds) {
  if (!creds.site) throw new Error('site required');
  const bodyStr = body ? new URLSearchParams(body).toString() : null;
  const auth = Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname: `${creds.site}.chargebee.com`, path: `/api/v2${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'chargebee',
  name: 'Chargebee',
  category: 'billing',
  icon: 'CreditCard',
  description: 'Manage subscriptions, customers, invoices, and revenue with Chargebee.',
  configFields: [
    { key: 'site', label: 'Site Name', type: 'string', required: true, description: 'Your Chargebee site name (e.g. mycompany)' },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.site || !creds.api_key) throw new Error('site and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cbReq('GET', '/subscriptions?limit=1', null, creds); return { success: true, message: `Connected — ${r.list?.length ?? 0} subscription(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_subscriptions: async (params, creds) => cbReq('GET', `/subscriptions?limit=${params.limit || 100}&status[is]=${params.status || 'active'}`, null, creds),
    get_subscription: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return cbReq('GET', `/subscriptions/${params.id}`, null, creds);
    },
    list_customers: async (params, creds) => cbReq('GET', `/customers?limit=${params.limit || 100}`, null, creds),
    get_customer: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return cbReq('GET', `/customers/${params.id}`, null, creds);
    },
    list_invoices: async (params, creds) => cbReq('GET', `/invoices?limit=${params.limit || 100}&status[is]=${params.status || 'paid'}`, null, creds),
    list_plans: async (params, creds) => cbReq('GET', `/plans?limit=${params.limit || 100}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
