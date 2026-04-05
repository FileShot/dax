/**
 * Garmin Health API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function garminReq(path, creds) {
  return makeRequest({ method: 'GET', hostname: 'healthapi.garmin.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'garmin-health',
  name: 'Garmin Health',
  category: 'health',
  icon: 'MapPin',
  description: 'Access Garmin Health API data — activities, daily summaries, sleep, and heart rate.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
    { key: 'user_token', label: 'User Access Token (from user auth)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const r = await garminReq(`/wellness-api/rest/dailies?uploadStartTimeInSeconds=0&uploadEndTimeInSeconds=${Math.floor(Date.now() / 1000)}`, creds);
      return { success: true, message: 'Garmin Health connected' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_daily_summaries: async (params, creds) => {
      const end = params.end_ts || Math.floor(Date.now() / 1000);
      const start = params.start_ts || (end - 86400);
      return garminReq(`/wellness-api/rest/dailies?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`, creds);
    },
    get_activities: async (params, creds) => {
      const end = params.end_ts || Math.floor(Date.now() / 1000);
      const start = params.start_ts || (end - 86400 * 7);
      return garminReq(`/wellness-api/rest/activities?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`, creds);
    },
    get_sleep: async (params, creds) => {
      const end = params.end_ts || Math.floor(Date.now() / 1000);
      const start = params.start_ts || (end - 86400 * 7);
      return garminReq(`/wellness-api/rest/sleeps?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`, creds);
    },
    get_heart_rate: async (params, creds) => {
      const end = params.end_ts || Math.floor(Date.now() / 1000);
      const start = params.start_ts || (end - 86400);
      return garminReq(`/wellness-api/rest/heartRates?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`, creds);
    },
    get_body_composition: async (params, creds) => {
      const end = params.end_ts || Math.floor(Date.now() / 1000);
      const start = params.start_ts || (end - 86400 * 30);
      return garminReq(`/wellness-api/rest/bodyComps?uploadStartTimeInSeconds=${start}&uploadEndTimeInSeconds=${end}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
