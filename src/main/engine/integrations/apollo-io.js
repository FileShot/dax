/**
 * Apollo.io Sales Intelligence API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function apolloReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method, hostname: 'api.apollo.io', path: `/api/v1${path}${sep}api_key=${creds.api_key}`, headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'apollo-io',
  name: 'Apollo.io',
  category: 'crm',
  icon: 'Target',
  description: 'Find B2B leads, enrich contacts, and run sequences with Apollo.io sales intelligence.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await apolloReq('GET', '/auth/health', null, creds); return { success: true, message: `Authenticated as ${r.user?.email || 'user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_people: async (params, creds) => apolloReq('POST', '/mixed_people/search', { q_keywords: params.keywords, person_titles: params.titles || [], page: params.page || 1, per_page: params.per_page || 25 }, creds),
    get_person: async (params, creds) => {
      if (!params.person_id) throw new Error('person_id required');
      return apolloReq('GET', `/people/${params.person_id}`, null, creds);
    },
    search_organizations: async (params, creds) => apolloReq('POST', '/mixed_companies/search', { q_organization_name: params.name || '', person_locations: params.locations || [], page: params.page || 1, per_page: params.per_page || 25 }, creds),
    get_email: async (params, creds) => {
      if (!params.first_name || !params.last_name || !params.domain) throw new Error('first_name, last_name, and domain required');
      return apolloReq('GET', `/people/match?first_name=${encodeURIComponent(params.first_name)}&last_name=${encodeURIComponent(params.last_name)}&organization_name=${encodeURIComponent(params.domain)}&reveal_personal_emails=true`, null, creds);
    },
    list_sequences: async (params, creds) => apolloReq('GET', `/emailer_campaigns?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
