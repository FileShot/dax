/**
 * DOAJ (Directory of Open Access Journals) API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function doajReq(path) {
  return makeRequest({ method: 'GET', hostname: 'doaj.org', path, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'doaj',
  name: 'DOAJ',
  category: 'academic',
  icon: 'BookMarked',
  description: 'Search the Directory of Open Access Journals (DOAJ) for journals and articles.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await doajReq('/api/search/journals/open+access?pageSize=1'); return { success: true, message: `DOAJ: ${r.total} journals` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_journals: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return doajReq(`/api/search/journals/${encodeURIComponent(params.query)}?pageSize=${params.page_size || 10}&page=${params.page || 1}`);
    },
    get_journal: async (params, creds) => {
      if (!params.issn) throw new Error('issn required');
      return doajReq(`/api/journals/${params.issn}`);
    },
    search_articles: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return doajReq(`/api/search/articles/${encodeURIComponent(params.query)}?pageSize=${params.page_size || 10}&page=${params.page || 1}`);
    },
    get_article: async (params, creds) => {
      if (!params.article_id) throw new Error('article_id required');
      return doajReq(`/api/articles/${params.article_id}`);
    },
    search_by_subject: async (params, creds) => {
      if (!params.subject) throw new Error('subject required');
      return doajReq(`/api/search/journals/${encodeURIComponent(params.subject)}?pageSize=${params.page_size || 10}&field=bibjson.subject.term`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
