/**
 * Tesla Fleet API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function teslaReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'fleet-api.prd.vn.cloud.tesla.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'tesla',
  name: 'Tesla',
  category: 'smarthome',
  icon: 'Car',
  description: 'Monitor and control Tesla vehicles via the Tesla Fleet API.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await teslaReq('GET', '/api/1/vehicles', null, creds); return { success: true, message: `Found ${(r.response || []).length} vehicle(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_vehicles: async (params, creds) => {
      return teslaReq('GET', '/api/1/vehicles', null, creds);
    },
    get_vehicle_data: async (params, creds) => {
      if (!params.vehicle_id) throw new Error('vehicle_id required');
      return teslaReq('GET', `/api/1/vehicles/${params.vehicle_id}/vehicle_data`, null, creds);
    },
    wake_up: async (params, creds) => {
      if (!params.vehicle_id) throw new Error('vehicle_id required');
      return teslaReq('POST', `/api/1/vehicles/${params.vehicle_id}/wake_up`, null, creds);
    },
    lock: async (params, creds) => {
      if (!params.vehicle_id) throw new Error('vehicle_id required');
      return teslaReq('POST', `/api/1/vehicles/${params.vehicle_id}/command/door_lock`, {}, creds);
    },
    unlock: async (params, creds) => {
      if (!params.vehicle_id) throw new Error('vehicle_id required');
      return teslaReq('POST', `/api/1/vehicles/${params.vehicle_id}/command/door_unlock`, {}, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
