/**
 * Hunter.io Email Finding API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function hunterReq(path, creds) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.hunter.io', path: `/v2${path}${sep}api_key=${creds.api_key}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'hunter',
  name: 'Hunter.io',
  category: 'marketing',
  icon: 'Mail',
  description: 'Find email addresses by domain or name, and verify deliverability with Hunter.io.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hunterReq('/account', creds); return { success: true, message: `Plan: ${r.data?.plan_name} — ${r.data?.requests?.searches?.available} searches left` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    domain_search: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return hunterReq(`/domain-search?domain=${encodeURIComponent(params.domain)}&limit=${params.limit || 10}&type=${params.type || ''}`, creds);
    },
    email_finder: async (params, creds) => {
      if (!params.domain || !params.first_name || !params.last_name) throw new Error('domain, first_name, last_name required');
      return hunterReq(`/email-finder?domain=${encodeURIComponent(params.domain)}&first_name=${encodeURIComponent(params.first_name)}&last_name=${encodeURIComponent(params.last_name)}`, creds);
    },
    email_verifier: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return hunterReq(`/email-verifier?email=${encodeURIComponent(params.email)}`, creds);
    },
    email_count: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return hunterReq(`/email-count?domain=${encodeURIComponent(params.domain)}`, creds);
    },
    account: async (params, creds) => hunterReq('/account', creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
