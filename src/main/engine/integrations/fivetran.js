/**
 * Fivetran Data Integration API
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fivetranReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.api_key}:${creds.api_secret}`).toString('base64');
  const opts = { method, hostname: 'api.fivetran.com', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json;version=2', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'fivetran',
  name: 'Fivetran',
  category: 'data',
  icon: 'GitMerge',
  description: 'Manage connectors, syncs, destinations, and monitor pipeline health with Fivetran.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'string', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.api_secret) throw new Error('api_key and api_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fivetranReq('GET', '/connectors?limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.items?.length ?? 0} connector(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_connectors: async (params, creds) => fivetranReq('GET', `/connectors?limit=${params.limit || 20}${params.group_id ? `&group_id=${params.group_id}` : ''}`, null, creds),
    get_connector: async (params, creds) => {
      if (!params.connector_id) throw new Error('connector_id required');
      return fivetranReq('GET', `/connectors/${params.connector_id}`, null, creds);
    },
    sync_connector: async (params, creds) => {
      if (!params.connector_id) throw new Error('connector_id required');
      return fivetranReq('POST', `/connectors/${params.connector_id}/force`, {}, creds);
    },
    get_connector_schema: async (params, creds) => {
      if (!params.connector_id) throw new Error('connector_id required');
      return fivetranReq('GET', `/connectors/${params.connector_id}/schemas`, null, creds);
    },
    list_destinations: async (params, creds) => fivetranReq('GET', `/destinations?limit=${params.limit || 20}`, null, creds),
    list_groups: async (params, creds) => fivetranReq('GET', `/groups?limit=${params.limit || 20}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
