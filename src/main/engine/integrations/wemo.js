/**
 * Belkin Wemo Smart Plug/Switch Integration
 * Uses the Wemo REST-like cloud API (developer.wemo.com)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function wemoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'developer.wemo.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'wemo',
  name: 'Belkin Wemo',
  category: 'smarthome',
  icon: 'Power',
  description: 'Control Belkin Wemo smart plugs and switches — toggle power and check device state.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wemoReq('GET', '/api/v1/devices', null, creds); return { success: true, message: `Found ${(r.devices || []).length} device(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_devices: async (params, creds) => {
      return wemoReq('GET', '/api/v1/devices', null, creds);
    },
    get_binary_state: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return wemoReq('GET', `/api/v1/devices/${params.device_id}/state`, null, creds);
    },
    set_binary_state: async (params, creds) => {
      if (!params.device_id || params.state === undefined) throw new Error('device_id and state required');
      return wemoReq('PUT', `/api/v1/devices/${params.device_id}/state`, { state: params.state ? 1 : 0 }, creds);
    },
    toggle: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return wemoReq('POST', `/api/v1/devices/${params.device_id}/toggle`, null, creds);
    },
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return wemoReq('GET', `/api/v1/devices/${params.device_id}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
