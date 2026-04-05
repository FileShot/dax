/**
 * ORCID Public API Integration (free, no auth for public reads)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function orcidReq(path) {
  return makeRequest({ method: 'GET', hostname: 'pub.orcid.org', path: `/v3.0${path}`, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'orcid',
  name: 'ORCID',
  category: 'academic',
  icon: 'User',
  description: 'Retrieve researcher profiles, works, affiliations, and identifiers from ORCID.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await orcidReq('/0000-0001-5109-3700'); return { success: true, message: `ORCID API reachable — ${r.person?.name?.['given-names']?.value || 'ok'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_record: async (params, creds) => {
      if (!params.orcid_id) throw new Error('orcid_id required (format: 0000-0000-0000-0000)');
      return orcidReq(`/${params.orcid_id}`);
    },
    get_works: async (params, creds) => {
      if (!params.orcid_id) throw new Error('orcid_id required');
      return orcidReq(`/${params.orcid_id}/works`);
    },
    get_person: async (params, creds) => {
      if (!params.orcid_id) throw new Error('orcid_id required');
      return orcidReq(`/${params.orcid_id}/person`);
    },
    get_employment: async (params, creds) => {
      if (!params.orcid_id) throw new Error('orcid_id required');
      return orcidReq(`/${params.orcid_id}/employments`);
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return orcidReq(`/search?q=${encodeURIComponent(params.query)}&rows=${params.rows || 10}&start=${params.start || 0}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
