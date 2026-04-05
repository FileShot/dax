/**
 * WHOOP API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function whoopReq(path, creds) {
  return makeRequest({ method: 'GET', hostname: 'api.prod.whoop.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'whoop',
  name: 'WHOOP',
  category: 'health',
  icon: 'Heart',
  description: 'Access WHOOP fitness data — recovery, strain, sleep, and workout metrics.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await whoopReq('/developer/v1/user/profile/basic', creds); return { success: true, message: `Connected as ${r.first_name} ${r.last_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_profile: async (params, creds) => whoopReq('/developer/v1/user/profile/basic', creds),
    get_recovery: async (params, creds) => {
      const qs = params.start ? `?start=${params.start}&end=${params.end || new Date().toISOString()}` : '';
      return whoopReq(`/developer/v1/recovery${qs}`, creds);
    },
    get_sleep: async (params, creds) => {
      const qs = params.start ? `?start=${params.start}&end=${params.end || new Date().toISOString()}` : '';
      return whoopReq(`/developer/v1/activity/sleep${qs}`, creds);
    },
    get_workouts: async (params, creds) => {
      const qs = params.start ? `?start=${params.start}&end=${params.end || new Date().toISOString()}` : '';
      return whoopReq(`/developer/v1/activity/workout${qs}`, creds);
    },
    get_cycles: async (params, creds) => {
      const qs = params.start ? `?start=${params.start}&end=${params.end || new Date().toISOString()}` : '';
      return whoopReq(`/developer/v1/cycle${qs}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
