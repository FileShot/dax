/**
 * Crossref DOI Metadata API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function crReq(path, email) {
  const headers = { 'Accept': 'application/json' };
  if (email) headers['User-Agent'] = `Dax/1.0 (mailto:${email})`;
  return makeRequest({ method: 'GET', hostname: 'api.crossref.org', path, headers }, null);
}

module.exports = {
  id: 'crossref',
  name: 'Crossref',
  category: 'academic',
  icon: 'Link2',
  description: 'Retrieve scholarly metadata by DOI and search publications via the Crossref API.',
  configFields: [
    { key: 'email', label: 'Contact Email (for polite pool, optional)', type: 'text', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await crReq('/works?rows=1', creds.email); return { success: true, message: `Crossref: ${r.message?.['total-results']?.toLocaleString()} works` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_work: async (params, creds) => {
      if (!params.doi) throw new Error('doi required');
      return crReq(`/works/${encodeURIComponent(params.doi)}`, creds.email);
    },
    search_works: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, rows: params.rows || 10, offset: params.offset || 0, ...(params.filter && { filter: params.filter }) }).toString();
      return crReq(`/works?${qs}`, creds.email);
    },
    list_journals: async (params, creds) => {
      const qs = params.query ? `?query=${encodeURIComponent(params.query)}&rows=${params.rows || 10}` : `?rows=${params.rows || 10}`;
      return crReq(`/journals${qs}`, creds.email);
    },
    get_journal: async (params, creds) => {
      if (!params.issn) throw new Error('issn required');
      return crReq(`/journals/${params.issn}`, creds.email);
    },
    get_member: async (params, creds) => {
      if (!params.id) throw new Error('member id required');
      return crReq(`/members/${params.id}`, creds.email);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
