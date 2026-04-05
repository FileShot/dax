/**
 * Polar Accesslink Sports Data Integration
 */
'use strict';
const https = require('https');

function polarGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'www.polaraccesslink.com', path: `/v3${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'polar',
  name: 'Polar Accesslink',
  category: 'health',
  icon: 'Activity',
  description: 'Access Polar sports watch and fitness data via Polar Accesslink API.',
  configFields: [
    { key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true },
    { key: 'user_id', label: 'User ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.user_id) throw new Error('Access token and user ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await polarGet(`/users/${creds.user_id}`, creds.access_token); if (r.error) return { success: false, message: r.error }; return { success: true, message: `Connected — user ${r.polar_user_id || creds.user_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => {
      const uid = params.user_id || creds.user_id;
      return polarGet(`/users/${uid}`, creds.access_token);
    },
    get_physical_info: async (params, creds) => {
      const uid = params.user_id || creds.user_id;
      return polarGet(`/users/${uid}/physical-information`, creds.access_token);
    },
    list_exercises: async (params, creds) => {
      const uid = params.user_id || creds.user_id;
      return polarGet(`/users/${uid}/exercises`, creds.access_token);
    },
    get_exercise: async (params, creds) => {
      if (!params.exercise_id) throw new Error('exercise_id required');
      const uid = params.user_id || creds.user_id;
      return polarGet(`/users/${uid}/exercises/${params.exercise_id}`, creds.access_token);
    },
    get_exercise_fit: async (params, creds) => {
      if (!params.exercise_id) throw new Error('exercise_id required');
      const uid = params.user_id || creds.user_id;
      return polarGet(`/users/${uid}/exercises/${params.exercise_id}/fit`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
