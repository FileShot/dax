/**
 * Lusha B2B Contact Data API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function lushaReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.lusha.com', path: `/contacts${path}`, headers: { 'api_key': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'lusha',
  name: 'Lusha',
  category: 'crm',
  icon: 'UserCheck',
  description: 'Enrich contacts with B2B phone numbers, emails, and company data from Lusha.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lushaReq('GET', '/credit?&first_name=John&last_name=Smith&company=Microsoft', null, creds); return { success: true, message: `API key valid` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_contact: async (params, creds) => {
      if (!params.first_name || !params.last_name) throw new Error('first_name and last_name required');
      const qs = [ `first_name=${encodeURIComponent(params.first_name)}`, `last_name=${encodeURIComponent(params.last_name)}`, params.company ? `company=${encodeURIComponent(params.company)}` : '' ].filter(Boolean).join('&');
      return lushaReq('GET', `/credit?${qs}`, null, creds);
    },
    get_by_linkedin: async (params, creds) => {
      if (!params.linkedin_url) throw new Error('linkedin_url required');
      return lushaReq('GET', `/credit?linkedin_url=${encodeURIComponent(params.linkedin_url)}`, null, creds);
    },
    bulk_enrich: async (params, creds) => {
      if (!params.contacts || !Array.isArray(params.contacts)) throw new Error('contacts array required');
      return lushaReq('POST', '/bulk', { contacts: params.contacts }, creds);
    },
    get_company: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      const opts = { method: 'GET', hostname: 'api.lusha.com', path: `/company?domain=${encodeURIComponent(params.domain)}`, headers: { 'api_key': creds.api_key, 'Accept': 'application/json' } };
      return makeRequest(opts, null);
    },
    get_usage: async (params, creds) => {
      const opts = { method: 'GET', hostname: 'api.lusha.com', path: '/usage', headers: { 'api_key': creds.api_key, 'Accept': 'application/json' } };
      return makeRequest(opts, null);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
