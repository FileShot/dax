/**
 * Zenodo Research Repository API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function zenReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const sep = path.includes('?') ? '&' : '?';
  const auth = creds && creds.access_token ? `${sep}access_token=${creds.access_token}` : '';
  const opts = { method, hostname: 'zenodo.org', path: `${path}${auth}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'zenodo',
  name: 'Zenodo',
  category: 'academic',
  icon: 'Database',
  description: 'Search and retrieve research records from Zenodo, CERN\'s open science repository.',
  configFields: [
    { key: 'access_token', label: 'Access Token (optional, for deposits)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await zenReq('GET', '/api/records?size=1', null, creds); return { success: true, message: `Zenodo: ${r.hits?.total} records` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_records: async (params, creds) => {
      const qs = new URLSearchParams({ size: params.size || 10, page: params.page || 1, ...(params.query && { q: params.query }), ...(params.type && { type: params.type }), ...(params.communities && { communities: params.communities }) }).toString();
      return zenReq('GET', `/api/records?${qs}`, null, creds);
    },
    get_record: async (params, creds) => {
      if (!params.record_id) throw new Error('record_id required');
      return zenReq('GET', `/api/records/${params.record_id}`, null, creds);
    },
    get_by_doi: async (params, creds) => {
      if (!params.doi) throw new Error('doi required');
      return zenReq('GET', `/api/records?q=doi:"${encodeURIComponent(params.doi)}"`, null, creds);
    },
    list_deposits: async (params, creds) => {
      if (!creds.access_token) throw new Error('access_token required for deposits');
      return zenReq('GET', `/api/deposit/depositions?size=${params.size || 25}`, null, creds);
    },
    search_communities: async (params, creds) => {
      const qs = params.query ? `?q=${encodeURIComponent(params.query)}&size=${params.size || 10}` : `?size=${params.size || 10}`;
      return zenReq('GET', `/api/communities${qs}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
