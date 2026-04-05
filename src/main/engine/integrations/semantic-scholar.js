/**
 * Semantic Scholar Academic API Integration (free, optional API key)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ssReq(path, creds) {
  const headers = { 'Accept': 'application/json' };
  if (creds && creds.api_key) headers['x-api-key'] = creds.api_key;
  return makeRequest({ method: 'GET', hostname: 'api.semanticscholar.org', path, headers }, null);
}

module.exports = {
  id: 'semantic-scholar',
  name: 'Semantic Scholar',
  category: 'academic',
  icon: 'Search',
  description: 'Search academic papers, get citations, references, and author profiles from Semantic Scholar.',
  configFields: [
    { key: 'api_key', label: 'API Key (optional, for higher rate limits)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ssReq('/graph/v1/paper/search?query=machine+learning&limit=1', creds); return { success: true, message: `Found ${r.total} papers` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_papers: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const fields = params.fields || 'paperId,title,year,authors,abstract,citationCount';
      return ssReq(`/graph/v1/paper/search?query=${encodeURIComponent(params.query)}&limit=${params.limit || 10}&offset=${params.offset || 0}&fields=${fields}`, creds);
    },
    get_paper: async (params, creds) => {
      if (!params.paper_id) throw new Error('paper_id required (Semantic Scholar ID, DOI, arXiv ID, etc.)');
      const fields = params.fields || 'paperId,title,year,authors,abstract,references,citations,citationCount';
      return ssReq(`/graph/v1/paper/${encodeURIComponent(params.paper_id)}?fields=${fields}`, creds);
    },
    get_author: async (params, creds) => {
      if (!params.author_id) throw new Error('author_id required');
      const fields = params.fields || 'authorId,name,affiliations,paperCount,citationCount,hIndex';
      return ssReq(`/graph/v1/author/${params.author_id}?fields=${fields}`, creds);
    },
    get_references: async (params, creds) => {
      if (!params.paper_id) throw new Error('paper_id required');
      return ssReq(`/graph/v1/paper/${encodeURIComponent(params.paper_id)}/references?limit=${params.limit || 20}&fields=title,year,authors`, creds);
    },
    get_citations: async (params, creds) => {
      if (!params.paper_id) throw new Error('paper_id required');
      return ssReq(`/graph/v1/paper/${encodeURIComponent(params.paper_id)}/citations?limit=${params.limit || 20}&fields=title,year,authors`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
