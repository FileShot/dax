/**
 * Regulations.gov API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function regGet(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.regulations.gov', path: `/v4${path}${sep}api_key=${apiKey}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'regulations-gov',
  name: 'Regulations.gov',
  category: 'government',
  icon: 'Scale',
  description: 'Search federal regulations, dockets, documents, and public comments on Regulations.gov.',
  configFields: [{ key: 'api_key', label: 'API Key (register at api.data.gov)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await regGet('/documents?page[size]=1', creds.api_key); if (r.errors) return { success: false, message: r.errors[0]?.detail || 'API error' }; return { success: true, message: 'Connected to Regulations.gov' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_documents: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.query && { 'filter[searchTerm]': params.query }), ...(params.agency && { 'filter[agencyId]': params.agency }), ...(params.type && { 'filter[documentType]': params.type }), 'page[size]': String(params.page_size || 25), 'page[number]': String(params.page || 1), ...(params.sort && { sort: params.sort }) }).toString();
      return regGet(`/documents?${qs}`, creds.api_key);
    },
    get_document: async (params, creds) => {
      if (!params.id) throw new Error('document id required');
      return regGet(`/documents/${params.id}`, creds.api_key);
    },
    search_dockets: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.query && { 'filter[searchTerm]': params.query }), ...(params.agency && { 'filter[agencyId]': params.agency }), 'page[size]': String(params.page_size || 25) }).toString();
      return regGet(`/dockets?${qs}`, creds.api_key);
    },
    get_docket: async (params, creds) => {
      if (!params.id) throw new Error('docket id required');
      return regGet(`/dockets/${params.id}`, creds.api_key);
    },
    get_comments: async (params, creds) => {
      if (!params.document_id) throw new Error('document_id required');
      const qs = new URLSearchParams({ 'filter[commentOnId]': params.document_id, 'page[size]': String(params.page_size || 25) }).toString();
      return regGet(`/comments?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
