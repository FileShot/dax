/**
 * Vimeo API Integration
 */
'use strict';
const https = require('https');

function vimeoApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.vimeo.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.vimeo.*+json;version=3.4' } };
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
  id: 'vimeo',
  name: 'Vimeo',
  category: 'video',
  icon: 'Film',
  description: 'Manage videos, projects, and analytics on Vimeo.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await vimeoApi('GET', '/me', creds.access_token); return { success: !!r.uri, message: `Connected as ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => vimeoApi('GET', '/me', creds.access_token),
    list_videos: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 1, fields: 'uri,name,description,duration,stats,link' });
      return vimeoApi('GET', `/me/videos?${qs}`, creds.access_token);
    },
    get_video: async (params, creds) => { if (!params.video_id) throw new Error('video_id required'); return vimeoApi('GET', `/videos/${params.video_id}`, creds.access_token); },
    update_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.description) body.description = params.description;
      if (params.privacy) body.privacy = { view: params.privacy };
      return vimeoApi('PATCH', `/videos/${params.video_id}`, creds.access_token, body);
    },
    create_upload_link: async (params, creds) => {
      if (!params.size || !params.name) throw new Error('size and name required');
      return vimeoApi('POST', '/me/videos', creds.access_token, { upload: { approach: 'tus', size: params.size }, name: params.name, description: params.description || '' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
