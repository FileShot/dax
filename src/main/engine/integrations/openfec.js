/**
 * OpenFEC (Federal Election Commission) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fecGet(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.open.fec.gov', path: `/v1${path}${sep}api_key=${apiKey}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'openfec',
  name: 'OpenFEC',
  category: 'government',
  icon: 'Landmark',
  description: 'Search FEC campaign finance data — candidates, committees, filings, and disbursements.',
  configFields: [{ key: 'api_key', label: 'API Key (register at api.data.gov)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fecGet('/candidates/?per_page=1', creds.api_key); if (r.pagination) return { success: true, message: 'Connected to OpenFEC' }; if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to OpenFEC' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_candidates: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.name && { name: params.name }), ...(params.office && { office: params.office }), ...(params.state && { state: params.state }), ...(params.election_year && { election_year: String(params.election_year) }), per_page: String(params.per_page || 20), page: String(params.page || 1) }).toString();
      return fecGet(`/candidates/?${qs}`, creds.api_key);
    },
    get_candidate: async (params, creds) => {
      if (!params.candidate_id) throw new Error('candidate_id required');
      return fecGet(`/candidate/${params.candidate_id}/`, creds.api_key);
    },
    search_committees: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.name && { name: params.name }), ...(params.committee_type && { committee_type: params.committee_type }), per_page: String(params.per_page || 20), page: String(params.page || 1) }).toString();
      return fecGet(`/committees/?${qs}`, creds.api_key);
    },
    get_filing: async (params, creds) => {
      if (!params.committee_id) throw new Error('committee_id required');
      return fecGet(`/committee/${params.committee_id}/filings/?per_page=${params.per_page || 20}`, creds.api_key);
    },
    get_disbursements: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.committee_id && { committee_id: params.committee_id }), ...(params.recipient_name && { recipient_name: params.recipient_name }), ...(params.min_date && { min_date: params.min_date }), ...(params.max_date && { max_date: params.max_date }), per_page: String(params.per_page || 20) }).toString();
      return fecGet(`/disbursements/?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
