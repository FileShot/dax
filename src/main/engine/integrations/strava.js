/**
 * Strava Sports Activity Integration
 */
'use strict';
const https = require('https');

function stravaGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'www.strava.com', path: `/api/v3${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'strava',
  name: 'Strava',
  category: 'health',
  icon: 'Zap',
  description: 'Access Strava athlete data, activities, and performance metrics.',
  configFields: [
    { key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await stravaGet('/athlete', creds.access_token); if (r.errors || r.message === 'Authorization Error') return { success: false, message: r.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.firstname} ${r.lastname}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_athlete: async (_params, creds) => stravaGet('/athlete', creds.access_token),
    list_activities: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: String(params.per_page || 20), page: String(params.page || 1), ...(params.after && { after: String(params.after) }), ...(params.before && { before: String(params.before) }) }).toString();
      return stravaGet(`/athlete/activities?${qs}`, creds.access_token);
    },
    get_activity: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return stravaGet(`/activities/${params.id}`, creds.access_token);
    },
    get_stats: async (params, creds) => {
      if (!params.athlete_id) throw new Error('athlete_id required');
      return stravaGet(`/athletes/${params.athlete_id}/stats`, creds.access_token);
    },
    get_activity_streams: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      const keys = params.keys || 'time,distance,heartrate,altitude';
      return stravaGet(`/activities/${params.id}/streams?keys=${encodeURIComponent(keys)}&key_by_type=true`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
