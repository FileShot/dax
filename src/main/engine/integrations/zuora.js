/**
 * Zuora Subscription Management API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getZuoraToken(creds) {
  return _cache.get(`zuora:${creds.client_id}`, async () => {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(creds.client_id)}&client_secret=${encodeURIComponent(creds.client_secret)}`;
    const host = creds.sandbox ? 'rest.apisandbox.zuora.com' : 'rest.zuora.com';
    const opts = { method: 'POST', hostname: host, path: '/oauth/token', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    return { token: r.access_token, expiresAt: Date.now() + (r.expires_in - 60) * 1000 };
  });
}

async function zuoraReq(method, path, body, creds) {
  const token = await getZuoraToken(creds);
  const host = creds.sandbox ? 'rest.apisandbox.zuora.com' : 'rest.zuora.com';
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: host, path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'zuora',
  name: 'Zuora',
  category: 'billing',
  icon: 'CreditCard',
  description: 'Manage subscriptions, accounts, invoices, and revenue recognition with Zuora.',
  configFields: [
    { key: 'client_id', label: 'OAuth Client ID', type: 'string', required: true },
    { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true },
    { key: 'sandbox', label: 'Use Sandbox', type: 'boolean', required: false },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('client_id and client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await zuoraReq('GET', '/accounts?pageSize=1', null, creds); return { success: true, message: `Connected to Zuora` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_accounts: async (params, creds) => zuoraReq('GET', `/accounts?pageSize=${params.page_size || 20}`, null, creds),
    get_account: async (params, creds) => {
      if (!params.account_key) throw new Error('account_key required');
      return zuoraReq('GET', `/accounts/${params.account_key}`, null, creds);
    },
    list_subscriptions: async (params, creds) => {
      if (!params.account_key) throw new Error('account_key required');
      return zuoraReq('GET', `/subscriptions/accounts/${params.account_key}`, null, creds);
    },
    list_invoices: async (params, creds) => {
      if (!params.account_key) throw new Error('account_key required');
      return zuoraReq('GET', `/transactions/invoices/accounts/${params.account_key}`, null, creds);
    },
    create_subscription: async (params, creds) => {
      if (!params.account_key || !params.subscription_terms) throw new Error('account_key and subscription_terms required');
      return zuoraReq('POST', '/subscriptions', { accountKey: params.account_key, ...params.subscription_terms }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
