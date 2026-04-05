/**
 * Dexcom CGM (Continuous Glucose Monitor) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dexReq(path, creds) {
  return makeRequest({ method: 'GET', hostname: 'api.dexcom.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'dexcom',
  name: 'Dexcom',
  category: 'health',
  icon: 'Activity',
  description: 'Access Dexcom continuous glucose monitoring (CGM) data — readings, events, and calibrations.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dexReq('/v3/users/self/devices', creds); return { success: true, message: `Found ${(r.records || []).length} device(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_glucose_readings: async (params, creds) => {
      const qs = `?startDate=${params.start_date || new Date(Date.now() - 86400000).toISOString()}&endDate=${params.end_date || new Date().toISOString()}`;
      return dexReq(`/v3/users/self/egvs${qs}`, creds);
    },
    get_devices: async (params, creds) => dexReq('/v3/users/self/devices', creds),
    get_events: async (params, creds) => {
      const qs = `?startDate=${params.start_date || new Date(Date.now() - 86400000).toISOString()}&endDate=${params.end_date || new Date().toISOString()}`;
      return dexReq(`/v3/users/self/events${qs}`, creds);
    },
    get_calibrations: async (params, creds) => {
      const qs = `?startDate=${params.start_date || new Date(Date.now() - 86400000).toISOString()}&endDate=${params.end_date || new Date().toISOString()}`;
      return dexReq(`/v3/users/self/calibrations${qs}`, creds);
    },
    get_statistics: async (params, creds) => {
      const qs = `?startDate=${params.start_date || new Date(Date.now() - 7 * 86400000).toISOString()}&endDate=${params.end_date || new Date().toISOString()}`;
      return dexReq(`/v3/users/self/statistics${qs}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
