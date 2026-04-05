/**
 * Cloudflare Stream API Integration
 */
'use strict';
const https = require('https');

function cfStream(method, path, token, accountId, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.cloudflare.com', path: `/client/v4/accounts/${accountId}/stream${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'cloudflare-stream',
  name: 'Cloudflare Stream',
  category: 'video',
  icon: 'Cloud',
  description: 'Upload, manage, and stream videos via Cloudflare Stream.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_token || !creds.account_id) throw new Error('API token and account ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cfStream('GET', '', creds.api_token, creds.account_id); return { success: r.success === true, message: `${r.result?.length || 0} video(s) found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_videos: async (params, creds) => {
      const qs = new URLSearchParams();
      if (params.search) qs.set('search', params.search);
      if (params.limit) qs.set('limit', params.limit);
      return cfStream('GET', `?${qs}`, creds.api_token, creds.account_id);
    },
    get_video: async (params, creds) => { if (!params.video_id) throw new Error('video_id required'); return cfStream('GET', `/${params.video_id}`, creds.api_token, creds.account_id); },
    delete_video: async (params, creds) => { if (!params.video_id) throw new Error('video_id required'); return cfStream('DELETE', `/${params.video_id}`, creds.api_token, creds.account_id); },
    create_upload_url: async (params, creds) => {
      if (!params.max_duration_seconds) throw new Error('max_duration_seconds required');
      return cfStream('POST', '/direct_upload', creds.api_token, creds.account_id, { maxDurationSeconds: params.max_duration_seconds, meta: { name: params.name || 'Untitled' } });
    },
    get_embed_code: async (params, creds) => { if (!params.video_id) throw new Error('video_id required'); return cfStream('GET', `/${params.video_id}/embed`, creds.api_token, creds.account_id); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
