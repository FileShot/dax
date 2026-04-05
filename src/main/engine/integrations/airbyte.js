/**
 * Airbyte Cloud/OSS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function airbyteReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.host || 'api.airbyte.com';
  const opts = { method, hostname: host, path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'airbyte',
  name: 'Airbyte',
  category: 'data',
  icon: 'GitMerge',
  description: 'Manage connections, sources, destinations, and trigger syncs via Airbyte.',
  configFields: [
    { key: 'api_key', label: 'API Key / Client Credential', type: 'password', required: true },
    { key: 'host', label: 'Host (optional)', type: 'string', required: false, description: 'Defaults to api.airbyte.com for Cloud' },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await airbyteReq('GET', '/connections?limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} connection(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_connections: async (params, creds) => airbyteReq('GET', `/connections?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    get_connection: async (params, creds) => {
      if (!params.connection_id) throw new Error('connection_id required');
      return airbyteReq('GET', `/connections/${params.connection_id}`, null, creds);
    },
    trigger_sync: async (params, creds) => {
      if (!params.connection_id) throw new Error('connection_id required');
      return airbyteReq('POST', '/jobs', { connectionId: params.connection_id, jobType: params.job_type || 'sync' }, creds);
    },
    get_job: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return airbyteReq('GET', `/jobs/${params.job_id}`, null, creds);
    },
    list_sources: async (params, creds) => airbyteReq('GET', `/sources?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    list_destinations: async (params, creds) => airbyteReq('GET', `/destinations?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
