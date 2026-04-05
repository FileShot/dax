/**
 * Census Reverse ETL API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function censusReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'app.getcensus.com', path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'census',
  name: 'Census',
  category: 'data',
  icon: 'GitMerge',
  description: 'Trigger syncs and manage models and destinations with Census Reverse ETL.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await censusReq('GET', '/syncs?per_page=1&page=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} sync(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_syncs: async (params, creds) => censusReq('GET', `/syncs?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds),
    get_sync: async (params, creds) => {
      if (!params.sync_id) throw new Error('sync_id required');
      return censusReq('GET', `/syncs/${params.sync_id}`, null, creds);
    },
    trigger_sync: async (params, creds) => {
      if (!params.sync_id) throw new Error('sync_id required');
      return censusReq('POST', `/syncs/${params.sync_id}/trigger`, { full_sync: params.full_sync || false }, creds);
    },
    get_sync_run: async (params, creds) => {
      if (!params.sync_run_id) throw new Error('sync_run_id required');
      return censusReq('GET', `/sync_runs/${params.sync_run_id}`, null, creds);
    },
    list_sources: async (params, creds) => censusReq('GET', `/sources?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds),
    list_destinations: async (params, creds) => censusReq('GET', `/destinations?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
