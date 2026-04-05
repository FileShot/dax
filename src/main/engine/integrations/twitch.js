/**
 * Twitch Helix API Integration
 */
'use strict';
const https = require('https');

function twitchApi(method, path, token, clientId, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.twitch.tv', path: `/helix${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'twitch',
  name: 'Twitch',
  category: 'video',
  icon: 'Tv2',
  description: 'Access streams, clips, and channel data via Twitch Helix API.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.client_id) throw new Error('Access token and client ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await twitchApi('GET', '/users', creds.access_token, creds.client_id); return { success: !!r.data?.length, message: `Connected as ${r.data?.[0]?.display_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => {
      const qs = params.login ? `?login=${params.login}` : params.id ? `?id=${params.id}` : '';
      return twitchApi('GET', `/users${qs}`, creds.access_token, creds.client_id);
    },
    get_stream: async (params, creds) => {
      if (!params.user_login && !params.user_id) throw new Error('user_login or user_id required');
      const qs = params.user_login ? `?user_login=${params.user_login}` : `?user_id=${params.user_id}`;
      return twitchApi('GET', `/streams${qs}`, creds.access_token, creds.client_id);
    },
    list_clips: async (params, creds) => {
      if (!params.broadcaster_id) throw new Error('broadcaster_id required');
      const qs = new URLSearchParams({ broadcaster_id: params.broadcaster_id, first: params.first || 20 });
      return twitchApi('GET', `/clips?${qs}`, creds.access_token, creds.client_id);
    },
    get_channel_info: async (params, creds) => {
      if (!params.broadcaster_id) throw new Error('broadcaster_id required');
      return twitchApi('GET', `/channels?broadcaster_id=${params.broadcaster_id}`, creds.access_token, creds.client_id);
    },
    search_channels: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, first: params.first || 20 });
      return twitchApi('GET', `/search/channels?${qs}`, creds.access_token, creds.client_id);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
