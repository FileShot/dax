/**
 * Google Nest Smart Device Management (SDM) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function sdmReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'smartdevicemanagement.googleapis.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'nest-sdm',
  name: 'Google Nest (SDM)',
  category: 'smarthome',
  icon: 'Home',
  description: 'Control Google Nest thermostats, cameras, and doorbells via the Smart Device Management API.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
    { key: 'project_id', label: 'Google Device Access Project ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.project_id) throw new Error('access_token and project_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sdmReq('GET', `/v1/enterprises/${creds.project_id}/devices`, null, creds); return { success: true, message: `Found ${(r.devices || []).length} device(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (params, creds) => {
      return sdmReq('GET', `/v1/enterprises/${creds.project_id}/devices`, null, creds);
    },
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return sdmReq('GET', `/v1/enterprises/${creds.project_id}/devices/${params.device_id}`, null, creds);
    },
    execute_command: async (params, creds) => {
      if (!params.device_id || !params.command || !params.params) throw new Error('device_id, command, and params required');
      return sdmReq('POST', `/v1/enterprises/${creds.project_id}/devices/${params.device_id}:executeCommand`, { command: params.command, params: params.params }, creds);
    },
    list_structures: async (params, creds) => {
      return sdmReq('GET', `/v1/enterprises/${creds.project_id}/structures`, null, creds);
    },
    list_rooms: async (params, creds) => {
      if (!params.structure_id) throw new Error('structure_id required');
      return sdmReq('GET', `/v1/enterprises/${creds.project_id}/structures/${params.structure_id}/rooms`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
