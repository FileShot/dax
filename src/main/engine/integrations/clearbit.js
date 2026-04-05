/**
 * Clearbit Data Enrichment API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function clearReq(hostname, path, creds) {
  const token = Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method: 'GET', hostname, path, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'clearbit',
  name: 'Clearbit',
  category: 'marketing',
  icon: 'Search',
  description: 'Enrich leads with company and person data — emails, domains, and company profiles.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await clearReq('person.clearbit.com', '/v2/combined/find?email=alex@clearbit.com', creds); return { success: true, message: `API connected` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    enrich_person: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return clearReq('person.clearbit.com', `/v2/combined/find?email=${encodeURIComponent(params.email)}`, creds);
    },
    enrich_company: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return clearReq('company.clearbit.com', `/v2/companies/find?domain=${encodeURIComponent(params.domain)}`, creds);
    },
    reveal_ip: async (params, creds) => {
      if (!params.ip) throw new Error('ip required');
      return clearReq('reveal.clearbit.com', `/v1/companies/find?ip=${params.ip}`, creds);
    },
    logo: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return { url: `https://logo.clearbit.com/${params.domain}` };
    },
    search_companies: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = Object.entries(params.query).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      return clearReq('discovery.clearbit.com', `/v1/companies/search?${qs}&limit=${params.limit || 10}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
