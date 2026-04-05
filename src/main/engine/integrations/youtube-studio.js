/**
 * YouTube Studio (Data API v3) Integration
 */
'use strict';
const https = require('https');

function ytApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'www.googleapis.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'youtube-studio',
  name: 'YouTube Studio',
  category: 'video',
  icon: 'Video',
  description: 'Manage your YouTube channel, videos, playlists, and analytics.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ytApi('GET', '/youtube/v3/channels?part=snippet&mine=true', creds.access_token); return { success: !!r.items?.length, message: `Channel: ${r.items?.[0]?.snippet?.title}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_channel: async (params, creds) => {
      const qs = new URLSearchParams({ part: 'snippet,statistics,brandingSettings', mine: 'true' });
      return ytApi('GET', `/youtube/v3/channels?${qs}`, creds.access_token);
    },
    list_videos: async (params, creds) => {
      const qs = new URLSearchParams({ part: 'snippet,statistics', forMine: 'true', type: 'video', maxResults: params.max_results || 25 });
      return ytApi('GET', `/youtube/v3/search?${qs}`, creds.access_token);
    },
    get_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const qs = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: params.video_id });
      return ytApi('GET', `/youtube/v3/videos?${qs}`, creds.access_token);
    },
    update_video: async (params, creds) => {
      if (!params.video_id || !params.title) throw new Error('video_id and title required');
      return ytApi('PUT', '/youtube/v3/videos?part=snippet', creds.access_token, { id: params.video_id, snippet: { title: params.title, description: params.description || '', categoryId: params.category_id || '22' } });
    },
    list_playlists: async (params, creds) => {
      const qs = new URLSearchParams({ part: 'snippet,contentDetails', mine: 'true', maxResults: params.max_results || 25 });
      return ytApi('GET', `/youtube/v3/playlists?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
