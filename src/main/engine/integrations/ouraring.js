/**
 * Oura Ring Health Data Integration
 */
'use strict';
const https = require('https');

function ouraGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.ouraring.com', path: `/v2/usercollection${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function ouraGetPersonal(accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.ouraring.com', path: '/v2/usercollection/personal_info', headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'ouraring',
  name: 'Oura Ring',
  category: 'health',
  icon: 'Circle',
  description: 'Access Oura Ring health metrics including sleep, activity, and readiness data.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ouraGetPersonal(creds.access_token); if (r.detail) return { success: false, message: r.detail }; return { success: true, message: `Connected — email: ${r.email || 'Oura user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_personal_info: async (_params, creds) => ouraGetPersonal(creds.access_token),
    get_daily_activity: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.start_date && { start_date: params.start_date }), ...(params.end_date && { end_date: params.end_date }) }).toString();
      return ouraGet(`/daily_activity${qs ? '?' + qs : ''}`, creds.access_token);
    },
    get_daily_sleep: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.start_date && { start_date: params.start_date }), ...(params.end_date && { end_date: params.end_date }) }).toString();
      return ouraGet(`/daily_sleep${qs ? '?' + qs : ''}`, creds.access_token);
    },
    get_daily_readiness: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.start_date && { start_date: params.start_date }), ...(params.end_date && { end_date: params.end_date }) }).toString();
      return ouraGet(`/daily_readiness${qs ? '?' + qs : ''}`, creds.access_token);
    },
    get_heart_rate: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.start_datetime && { start_datetime: params.start_datetime }), ...(params.end_datetime && { end_datetime: params.end_datetime }) }).toString();
      return ouraGet(`/heartrate${qs ? '?' + qs : ''}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
