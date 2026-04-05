/**
 * Recurly Subscription Management API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function recurlyReq(method, path, body, creds) {
  if (!creds.site) throw new Error('site required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'v3.recurly.com', path: `/sites/${creds.site}${path}`, headers: { 'Authorization': `Basic ${Buffer.from(creds.api_key + ':').toString('base64')}`, 'Accept': 'application/vnd.recurly.v2021-02-25+json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'recurly',
  name: 'Recurly',
  category: 'billing',
  icon: 'CreditCard',
  description: 'Manage subscriptions, accounts, invoices, and billing with Recurly.',
  configFields: [
    { key: 'site', label: 'Site ID', type: 'string', required: true, description: 'Your Recurly site ID (e.g. mycompany or subdomain)' },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.site || !creds.api_key) throw new Error('site and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await recurlyReq('GET', '/accounts?limit=1', null, creds); return { success: true, message: `Connected — ${r.has_more !== undefined ? 'OK' : 0} account(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_accounts: async (params, creds) => recurlyReq('GET', `/accounts?limit=${params.limit || 20}&sort=${params.sort || 'created_at'}&order=${params.order || 'desc'}`, null, creds),
    get_account: async (params, creds) => {
      if (!params.account_code) throw new Error('account_code required');
      return recurlyReq('GET', `/accounts/${params.account_code}`, null, creds);
    },
    list_subscriptions: async (params, creds) => recurlyReq('GET', `/subscriptions?limit=${params.limit || 20}&state=${params.state || 'active'}`, null, creds),
    get_subscription: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return recurlyReq('GET', `/subscriptions/${params.id}`, null, creds);
    },
    list_invoices: async (params, creds) => recurlyReq('GET', `/invoices?limit=${params.limit || 20}&state=${params.state || 'paid'}`, null, creds),
    list_plans: async (params, creds) => recurlyReq('GET', `/plans?limit=${params.limit || 20}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
