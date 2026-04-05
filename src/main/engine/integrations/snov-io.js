/**
 * Snov.io Email Outreach API Integration
 */
'use strict';
const { TokenCache, makeRequest } = require('../../engine/integration-utils');

const _tokenCache = new TokenCache(3500);

async function getToken(creds) {
  const key = `snovio:${creds.client_id}`;
  if (_tokenCache.get(key)) return _tokenCache.get(key);
  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(creds.client_id)}&client_secret=${encodeURIComponent(creds.client_secret)}`;
  const opts = { method: 'POST', hostname: 'api.snov.io', path: '/v1/oauth/access_token', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
  const r = await makeRequest(opts, body);
  _tokenCache.set(key, r.access_token);
  return r.access_token;
}

async function snovReq(method, path, body, creds) {
  const token = await getToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.snov.io', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'snov-io',
  name: 'Snov.io',
  category: 'marketing',
  icon: 'Send',
  description: 'Find and verify emails, enrich prospects, and manage drip campaigns with Snov.io.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('client_id and client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds); return { success: true, message: 'OAuth token obtained' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    find_emails_by_domain: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return snovReq('POST', '/get-domain-emails', { domain: params.domain, type: params.type || 'all', limit: params.limit || 10 }, creds);
    },
    verify_email: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return snovReq('POST', '/get-emails-verification-status', { emails: [params.email] }, creds);
    },
    add_prospect: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return snovReq('POST', '/add-prospect-to-list', { email: params.email, firstName: params.first_name || '', lastName: params.last_name || '', listId: params.list_id }, creds);
    },
    get_prospect: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return snovReq('POST', '/get-prospect-by-email', { email: params.email }, creds);
    },
    list_prospects: async (params, creds) => snovReq('POST', '/get-prospects-from-list', { listId: params.list_id, page: params.page || 1, perPage: params.per_page || 25 }, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
