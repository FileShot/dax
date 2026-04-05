/**
 * Billsby Subscription Billing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function billsbyReq(method, path, body, creds) {
  if (!creds.company_domain) throw new Error('company_domain required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.company_domain}:${creds.api_key}`).toString('base64');
  const opts = { method, hostname: 'public.billsby.com', path: `/api/v1/recurly/${creds.company_domain}${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'billsby',
  name: 'Billsby',
  category: 'billing',
  icon: 'CreditCard',
  description: 'Manage customers, subscriptions, and billing plans with Billsby.',
  configFields: [
    { key: 'company_domain', label: 'Company Domain', type: 'string', required: true, description: 'Your Billsby company domain/slug' },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.company_domain || !creds.api_key) throw new Error('company_domain and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await billsbyReq('GET', '/customers?page=1&pageSize=1', null, creds); return { success: true, message: `Connected — ${r.totalNumberOfRecords ?? 0} customer(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_customers: async (params, creds) => billsbyReq('GET', `/customers?page=${params.page || 1}&pageSize=${params.page_size || 25}`, null, creds),
    get_customer: async (params, creds) => {
      if (!params.customer_unique_id) throw new Error('customer_unique_id required');
      return billsbyReq('GET', `/customers/${params.customer_unique_id}`, null, creds);
    },
    list_subscriptions: async (params, creds) => {
      if (!params.customer_unique_id) throw new Error('customer_unique_id required');
      return billsbyReq('GET', `/customers/${params.customer_unique_id}/subscriptions`, null, creds);
    },
    get_subscription: async (params, creds) => {
      if (!params.customer_unique_id || !params.subscription_unique_id) throw new Error('customer_unique_id and subscription_unique_id required');
      return billsbyReq('GET', `/customers/${params.customer_unique_id}/subscriptions/${params.subscription_unique_id}`, null, creds);
    },
    list_plans: async (params, creds) => billsbyReq('GET', `/plans?page=${params.page || 1}&pageSize=${params.page_size || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
