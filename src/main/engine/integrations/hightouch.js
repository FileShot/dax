/**
 * Hightouch Reverse ETL API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function htReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.hightouch.com', path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'hightouch',
  name: 'Hightouch',
  category: 'data',
  icon: 'GitMerge',
  description: 'Trigger syncs, monitor sync status, and manage models with Hightouch Reverse ETL.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await htReq('GET', '/syncs?limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} sync(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_syncs: async (params, creds) => htReq('GET', `/syncs?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    get_sync: async (params, creds) => {
      if (!params.sync_id) throw new Error('sync_id required');
      return htReq('GET', `/syncs/${params.sync_id}`, null, creds);
    },
    trigger_sync: async (params, creds) => {
      if (!params.sync_id) throw new Error('sync_id required');
      return htReq('POST', `/syncs/${params.sync_id}/trigger`, { fullResync: params.full_resync || false }, creds);
    },
    get_sync_run: async (params, creds) => {
      if (!params.sync_id || !params.sync_run_id) throw new Error('sync_id and sync_run_id required');
      return htReq('GET', `/syncs/${params.sync_id}/runs/${params.sync_run_id}`, null, creds);
    },
    list_models: async (params, creds) => htReq('GET', `/models?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    list_sources: async (params, creds) => htReq('GET', `/sources?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
