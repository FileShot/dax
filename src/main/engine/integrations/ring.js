/**
 * Ring Alarm & Doorbell API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ringReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.ring.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json', 'hardware_id': creds.hardware_id || 'dax-integration', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'ring',
  name: 'Ring',
  category: 'smarthome',
  icon: 'Bell',
  description: 'Monitor Ring doorbells, cameras, and alarm devices.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
    { key: 'hardware_id', label: 'Hardware ID (optional, for auth)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ringReq('GET', '/clients_api/ring_devices', null, creds); return { success: true, message: 'Ring devices loaded' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (params, creds) => {
      return ringReq('GET', '/clients_api/ring_devices', null, creds);
    },
    get_doorbells: async (params, creds) => {
      const r = await ringReq('GET', '/clients_api/ring_devices', null, creds);
      return r.doorbots || [];
    },
    get_history: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}${params.older_than ? `&older_than=${params.older_than}` : ''}`;
      return ringReq('GET', `/clients_api/doorbots/history${qs}`, null, creds);
    },
    get_health: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      const type = params.type || 'doorbots';
      return ringReq('GET', `/clients_api/${type}/${params.device_id}/health`, null, creds);
    },
    get_account: async (params, creds) => {
      return ringReq('GET', '/clients_api/profile', null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
