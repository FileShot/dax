/**
 * PubMed / NCBI Entrez API Integration (free, optional API key)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function pubReq(path, creds) {
  const sep = path.includes('?') ? '&' : '?';
  const key = creds && creds.api_key ? `${sep}api_key=${creds.api_key}` : '';
  return makeRequest({ method: 'GET', hostname: 'eutils.ncbi.nlm.nih.gov', path: `${path}${key}&retmode=json`, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'pubmed',
  name: 'PubMed',
  category: 'academic',
  icon: 'Microscope',
  description: 'Search biomedical literature from PubMed/NCBI using the Entrez API.',
  configFields: [
    { key: 'api_key', label: 'NCBI API Key (optional, for higher rate limits)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pubReq('/entrez/eutils/esearch.fcgi?db=pubmed&term=covid&retmax=1', creds); return { success: true, message: `PubMed: ${r.esearchresult?.count} results for 'covid'` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return pubReq(`/entrez/eutils/esearch.fcgi?db=${params.db || 'pubmed'}&term=${encodeURIComponent(params.query)}&retmax=${params.retmax || 20}&retstart=${params.retstart || 0}&sort=${params.sort || 'relevance'}`, creds);
    },
    fetch: async (params, creds) => {
      if (!params.ids) throw new Error('ids (comma-separated PMIDs) required');
      return pubReq(`/entrez/eutils/efetch.fcgi?db=${params.db || 'pubmed'}&id=${params.ids}&rettype=abstract`, creds);
    },
    summary: async (params, creds) => {
      if (!params.ids) throw new Error('ids (comma-separated PMIDs) required');
      return pubReq(`/entrez/eutils/esummary.fcgi?db=${params.db || 'pubmed'}&id=${params.ids}`, creds);
    },
    link: async (params, creds) => {
      if (!params.id) throw new Error('id (PMID) required');
      return pubReq(`/entrez/eutils/elink.fcgi?dbfrom=${params.dbfrom || 'pubmed'}&db=${params.db || 'pubmed'}&id=${params.id}&cmd=${params.cmd || 'neighbor_score'}`, creds);
    },
    spell_check: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return pubReq(`/entrez/eutils/espell.fcgi?db=${params.db || 'pubmed'}&term=${encodeURIComponent(params.query)}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
