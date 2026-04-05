/**
 * Loom API Integration
 */
'use strict';
const https = require('https');

function loomApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'developer.loom.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'loom',
  name: 'Loom',
  category: 'design',
  icon: 'Video',
  description: 'Manage video recordings and workspace in Loom.',
  configFields: [
    { key: 'access_token', label: 'Developer Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await loomApi('GET', '/me', creds.access_token); return { success: !!r.id || !!r.email, message: 'Connected to Loom' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_videos: async (params, creds) => loomApi('GET', `/videos?limit=${params.limit || 20}`, creds.access_token),
    get_video: async (params, creds) => { if (!params.video_id) throw new Error('video_id required'); return loomApi('GET', `/videos/${params.video_id}`, creds.access_token); },
    delete_video: async (params, creds) => { if (!params.video_id) throw new Error('video_id required'); return loomApi('DELETE', `/videos/${params.video_id}`, creds.access_token); },
    update_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const body = {};
      if (params.title) body.title = params.title;
      if (params.description) body.description = params.description;
      return loomApi('PATCH', `/videos/${params.video_id}`, creds.access_token, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
