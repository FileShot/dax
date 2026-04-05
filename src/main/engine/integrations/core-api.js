/**
 * CORE Open Access API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function coreReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.core.ac.uk', path, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'core-api',
  name: 'CORE',
  category: 'academic',
  icon: 'Archive',
  description: 'Search and retrieve open access research outputs from the CORE aggregation platform.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await coreReq('GET', '/v3/search/works?q=AI&limit=1', null, creds); return { success: true, message: `CORE: ${r.totalHits} total works` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_works: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return coreReq('GET', `/v3/search/works?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}&offset=${params.offset || 0}${params.open_access ? '&filters=isOpenAccess:true' : ''}`, null, creds);
    },
    get_work: async (params, creds) => {
      if (!params.id) throw new Error('CORE work id required');
      return coreReq('GET', `/v3/works/${params.id}`, null, creds);
    },
    search_data_providers: async (params, creds) => {
      const qs = params.query ? `?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}` : `?limit=${params.limit || 10}`;
      return coreReq('GET', `/v3/data-providers${qs}`, null, creds);
    },
    get_similar: async (params, creds) => {
      if (!params.id) throw new Error('work id required');
      return coreReq('GET', `/v3/recommend/${params.id}`, null, creds);
    },
    batch_works: async (params, creds) => {
      if (!params.ids || !Array.isArray(params.ids)) throw new Error('ids array required');
      return coreReq('POST', '/v3/works', params.ids.map(id => ({ id })), creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
