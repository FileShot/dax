/**
 * Withings Health API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function withingsReq(action, params, creds) {
  const body = new URLSearchParams({ action, ...params }).toString();
  return makeRequest({ method: 'POST', hostname: 'wbsapi.withings.net', path: '/v2/measure', headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
}
function withingsGet(path, creds) {
  return makeRequest({ method: 'GET', hostname: 'wbsapi.withings.net', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'withings',
  name: 'Withings',
  category: 'health',
  icon: 'Scale',
  description: 'Access Withings health device data — weight, blood pressure, activity, and sleep.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await withingsGet('/v2/user?action=getdevice', creds); return { success: true, message: `Found ${(r.body?.devices || []).length} device(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_measurements: async (params, creds) => {
      const p = { meastype: params.meastype || '1', category: params.category || '1' };
      if (params.startdate) p.startdate = params.startdate;
      if (params.enddate) p.enddate = params.enddate;
      return withingsReq('getmeas', p, creds);
    },
    get_activity: async (params, creds) => {
      if (!params.startdateymd) throw new Error('startdateymd required (YYYY-MM-DD)');
      const body = new URLSearchParams({ action: 'getactivity', startdateymd: params.startdateymd, enddateymd: params.enddateymd || params.startdateymd }).toString();
      return makeRequest({ method: 'POST', hostname: 'wbsapi.withings.net', path: '/v2/measure', headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
    },
    get_sleep: async (params, creds) => {
      if (!params.startdate || !params.enddate) throw new Error('startdate and enddate (Unix timestamps) required');
      const body = new URLSearchParams({ action: 'get', startdate: params.startdate, enddate: params.enddate }).toString();
      return makeRequest({ method: 'POST', hostname: 'wbsapi.withings.net', path: '/v2/sleep', headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
    },
    get_devices: async (params, creds) => withingsGet('/v2/user?action=getdevice', creds),
    get_heart: async (params, creds) => {
      const body = new URLSearchParams({ action: 'list' }).toString();
      return makeRequest({ method: 'POST', hostname: 'wbsapi.withings.net', path: '/v2/heart', headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
