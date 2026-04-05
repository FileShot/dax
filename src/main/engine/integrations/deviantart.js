/**
 * DeviantArt API Integration
 */
'use strict';
const https = require('https');

function daGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'www.deviantart.com', path: `/api/v1/oauth2${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'deviantart',
  name: 'DeviantArt',
  category: 'social',
  icon: 'Palette',
  description: 'Browse DeviantArt deviations, user galleries, and discover popular art.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await daGet('/user/whoami', creds.access_token); if (r.error) return { success: false, message: r.error_description || r.error }; return { success: true, message: `Connected as ${r.username}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (_p, creds) => daGet('/user/whoami', creds.access_token),
    browse_popular: async (params, creds) => {
      const qs = new URLSearchParams({ timerange: params.timerange || 'alltime', limit: String(params.limit || 20), offset: String(params.offset || 0) }).toString();
      return daGet(`/browse/popular?${qs}`, creds.access_token);
    },
    browse_newest: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), offset: String(params.offset || 0), ...(params.q && { q: params.q }) }).toString();
      return daGet(`/browse/newest?${qs}`, creds.access_token);
    },
    get_deviation: async (params, creds) => {
      if (!params.deviation_id) throw new Error('deviation_id required');
      return daGet(`/deviation/${params.deviation_id}`, creds.access_token);
    },
    get_user_gallery: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const qs = new URLSearchParams({ username: params.username, limit: String(params.limit || 20), offset: String(params.offset || 0) }).toString();
      return daGet(`/gallery/?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
