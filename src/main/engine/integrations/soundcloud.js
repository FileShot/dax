/**
 * SoundCloud API v2 Integration
 */
'use strict';
const https = require('https');

function scGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.soundcloud.com', path, headers: { 'Authorization': `OAuth ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'soundcloud',
  name: 'SoundCloud',
  category: 'social',
  icon: 'Music',
  description: 'Access SoundCloud tracks, playlists, and user profiles.',
  configFields: [{ key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await scGet('/me', creds.access_token); if (r.error) return { success: false, message: r.error }; return { success: true, message: `Connected as ${r.username}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (_p, creds) => scGet('/me', creds.access_token),
    get_stream: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.cursor && { cursor: params.cursor }) }).toString();
      return scGet(`/stream?${qs}`, creds.access_token);
    },
    list_tracks: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20) }).toString();
      return scGet(`/me/tracks?${qs}`, creds.access_token);
    },
    get_track: async (params, creds) => {
      if (!params.track_id) throw new Error('track_id required');
      return scGet(`/tracks/${params.track_id}`, creds.access_token);
    },
    search_tracks: async (params, creds) => {
      if (!params.q) throw new Error('q required');
      const qs = new URLSearchParams({ q: params.q, limit: String(params.limit || 20) }).toString();
      return scGet(`/tracks?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
