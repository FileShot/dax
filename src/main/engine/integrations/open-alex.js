/**
 * OpenAlex Academic Literature API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function oaReq(path, email) {
  const separator = path.includes('?') ? '&' : '?';
  const polite = email ? `${separator}mailto=${encodeURIComponent(email)}` : '';
  return makeRequest({ method: 'GET', hostname: 'api.openalex.org', path: `${path}${polite}`, headers: { 'Accept': 'application/json', 'User-Agent': `Dax/1.0 (mailto:${email || 'dax@example.com'})` } }, null);
}

module.exports = {
  id: 'open-alex',
  name: 'OpenAlex',
  category: 'academic',
  icon: 'BookOpen',
  description: 'Search the OpenAlex academic graph — papers, authors, institutions, and concepts.',
  configFields: [
    { key: 'email', label: 'Contact Email (for polite pool, optional)', type: 'text', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await oaReq('/works?per-page=1', creds.email); return { success: true, message: `OpenAlex: ${r.meta?.count?.toLocaleString()} works indexed` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_works: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return oaReq(`/works?search=${encodeURIComponent(params.query)}&per-page=${params.per_page || 10}&page=${params.page || 1}`, creds.email);
    },
    get_work: async (params, creds) => {
      if (!params.id) throw new Error('OpenAlex work ID or DOI required');
      const id = params.id.startsWith('10.') ? `https://doi.org/${params.id}` : params.id;
      return oaReq(`/works/${encodeURIComponent(id)}`, creds.email);
    },
    search_authors: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return oaReq(`/authors?search=${encodeURIComponent(params.query)}&per-page=${params.per_page || 10}`, creds.email);
    },
    get_author: async (params, creds) => {
      if (!params.id) throw new Error('author ID required');
      return oaReq(`/authors/${params.id}`, creds.email);
    },
    search_concepts: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return oaReq(`/concepts?search=${encodeURIComponent(params.query)}&per-page=${params.per_page || 10}`, creds.email);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
