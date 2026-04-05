/**
 * Unpaywall Open Access API Integration (free, email required)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function upwReq(path, email) {
  const sep = path.includes('?') ? '&' : '?';
  return makeRequest({ method: 'GET', hostname: 'api.unpaywall.org', path: `${path}${sep}email=${encodeURIComponent(email)}`, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'unpaywall',
  name: 'Unpaywall',
  category: 'academic',
  icon: 'Unlock',
  description: 'Check open access availability and find free legal PDFs for any DOI via Unpaywall.',
  configFields: [
    { key: 'email', label: 'Contact Email (required by Unpaywall ToS)', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.email) throw new Error('email required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await upwReq('/v2/10.1038/nature12373', creds.email); return { success: true, message: `Unpaywall: ${r.is_oa ? 'open access' : 'not open access'} for test DOI` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_paper: async (params, creds) => {
      if (!params.doi) throw new Error('doi required');
      return upwReq(`/v2/${encodeURIComponent(params.doi)}`, creds.email);
    },
    check_oa: async (params, creds) => {
      if (!params.doi) throw new Error('doi required');
      const r = await upwReq(`/v2/${encodeURIComponent(params.doi)}`, creds.email);
      return { doi: r.doi, title: r.title, is_oa: r.is_oa, oa_status: r.oa_status, best_oa_location: r.best_oa_location };
    },
    get_pdf_url: async (params, creds) => {
      if (!params.doi) throw new Error('doi required');
      const r = await upwReq(`/v2/${encodeURIComponent(params.doi)}`, creds.email);
      return { doi: r.doi, pdf_url: r.best_oa_location?.url_for_pdf || null, landing_page: r.best_oa_location?.url || null };
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return upwReq(`/v2/search?query=${encodeURIComponent(params.query)}&is_oa=${params.is_oa !== undefined ? params.is_oa : true}`, creds.email);
    },
    get_availability: async (params, creds) => {
      if (!params.dois || !Array.isArray(params.dois)) throw new Error('dois array required');
      const results = await Promise.all(params.dois.map(doi => upwReq(`/v2/${encodeURIComponent(doi)}`, creds.email).then(r => ({ doi: r.doi, is_oa: r.is_oa, pdf_url: r.best_oa_location?.url_for_pdf })).catch(e => ({ doi, error: e.message }))));
      return results;
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
