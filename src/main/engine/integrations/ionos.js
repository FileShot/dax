/**
 * IONOS Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ionosReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  const opts = { method, hostname: 'api.ionos.com', path: `/cloudapi/v6${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'ionos',
  name: 'IONOS Cloud',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage IONOS Cloud datacenters, servers, volumes, and networking.',
  configFields: [
    { key: 'username', label: 'Username', type: 'string', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.username || !creds.password) throw new Error('username and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ionosReq('GET', '/datacenters?limit=1', null, creds); return { success: true, message: `Connected — ${r.offset !== undefined ? 'OK' : 0} datacenter(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_datacenters: async (params, creds) => ionosReq('GET', `/datacenters?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    get_datacenter: async (params, creds) => {
      if (!params.datacenter_id) throw new Error('datacenter_id required');
      return ionosReq('GET', `/datacenters/${params.datacenter_id}`, null, creds);
    },
    list_servers: async (params, creds) => {
      if (!params.datacenter_id) throw new Error('datacenter_id required');
      return ionosReq('GET', `/datacenters/${params.datacenter_id}/servers?limit=${params.limit || 20}`, null, creds);
    },
    get_server: async (params, creds) => {
      if (!params.datacenter_id || !params.server_id) throw new Error('datacenter_id and server_id required');
      return ionosReq('GET', `/datacenters/${params.datacenter_id}/servers/${params.server_id}`, null, creds);
    },
    start_server: async (params, creds) => {
      if (!params.datacenter_id || !params.server_id) throw new Error('datacenter_id and server_id required');
      return ionosReq('POST', `/datacenters/${params.datacenter_id}/servers/${params.server_id}/start`, {}, creds);
    },
    list_volumes: async (params, creds) => {
      if (!params.datacenter_id) throw new Error('datacenter_id required');
      return ionosReq('GET', `/datacenters/${params.datacenter_id}/volumes?limit=${params.limit || 20}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
