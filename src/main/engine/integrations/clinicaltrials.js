/**
 * ClinicalTrials.gov API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ctReq(path) {
  return makeRequest({ method: 'GET', hostname: 'clinicaltrials.gov', path, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'clinicaltrials',
  name: 'ClinicalTrials.gov',
  category: 'health',
  icon: 'Flask',
  description: 'Search and retrieve clinical trial information from ClinicalTrials.gov.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ctReq('/api/v2/studies?pageSize=1'); return { success: true, message: `ClinicalTrials.gov API reachable (${r.totalCount} studies)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_studies: async (params, creds) => {
      const qs = new URLSearchParams({ pageSize: params.page_size || 10, ...(params.query && { 'query.term': params.query }), ...(params.condition && { 'query.cond': params.condition }), ...(params.intervention && { 'query.intr': params.intervention }), ...(params.status && { 'filter.overallStatus': params.status }) }).toString();
      return ctReq(`/api/v2/studies?${qs}`);
    },
    get_study: async (params, creds) => {
      if (!params.nct_id) throw new Error('nct_id required (e.g. NCT01234567)');
      return ctReq(`/api/v2/studies/${params.nct_id}`);
    },
    get_metadata: async (params, creds) => {
      return ctReq('/api/v2/studies?pageSize=0');
    },
    search_by_location: async (params, creds) => {
      if (!params.city && !params.country) throw new Error('city or country required');
      const qs = new URLSearchParams({ pageSize: params.page_size || 10, ...(params.city && { 'query.locn': params.city }), ...(params.country && { 'filter.geo': `distance(${params.lat},${params.lng},${params.radius || 50}mi)` }) }).toString();
      return ctReq(`/api/v2/studies?${qs}`);
    },
    get_enums: async (params, creds) => {
      return ctReq('/api/v2/enums');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
