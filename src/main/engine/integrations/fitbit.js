/**
 * Fitbit Health & Fitness Data Integration
 */
'use strict';
const https = require('https');

function fitbitGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.fitbit.com', path: `/1${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'fitbit',
  name: 'Fitbit',
  category: 'health',
  icon: 'Heart',
  description: 'Access Fitbit health and fitness data including activity, sleep, and heart rate.',
  configFields: [
    { key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fitbitGet('/user/-/profile.json', creds.access_token); if (r.errors) return { success: false, message: r.errors[0]?.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.user?.displayName || 'Fitbit user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_profile: async (_params, creds) => fitbitGet('/user/-/profile.json', creds.access_token),
    get_activity: async (params, creds) => {
      const date = params.date || 'today';
      return fitbitGet(`/user/-/activities/date/${date}.json`, creds.access_token);
    },
    get_sleep: async (params, creds) => {
      const date = params.date || 'today';
      return fitbitGet(`/user/-/sleep/date/${date}.json`, creds.access_token);
    },
    get_heart_rate: async (params, creds) => {
      const date = params.date || 'today';
      const period = params.period || '1d';
      return fitbitGet(`/user/-/activities/heart/date/${date}/${period}.json`, creds.access_token);
    },
    get_body_weight: async (params, creds) => {
      const date = params.date || 'today';
      const period = params.period || '7d';
      return fitbitGet(`/user/-/body/weight/date/${date}/${period}.json`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
