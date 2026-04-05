/**
 * Wistia API Integration
 */
'use strict';
const https = require('https');

function wistiaApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`api:${apiKey}`).toString('base64');
    const opts = { method, hostname: 'api.wistia.com', path: `/v1${path}.json`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'wistia',
  name: 'Wistia',
  category: 'video',
  icon: 'PlayCircle',
  description: 'Manage and analyze video content hosted on Wistia.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wistiaApi('GET', '/account', creds.api_key); return { success: !!r.name, message: `Connected to ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_videos: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 1, sort_by: params.sort_by || 'created' });
      return wistiaApi('GET', `/medias?${qs}`, creds.api_key);
    },
    get_video: async (params, creds) => { if (!params.hashed_id) throw new Error('hashed_id required'); return wistiaApi('GET', `/medias/${params.hashed_id}`, creds.api_key); },
    list_projects: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 1 });
      return wistiaApi('GET', `/projects?${qs}`, creds.api_key);
    },
    get_stats: async (params, creds) => { if (!params.hashed_id) throw new Error('hashed_id required'); return wistiaApi('GET', `/stats/medias/${params.hashed_id}`, creds.api_key); },
    update_video: async (params, creds) => {
      if (!params.hashed_id) throw new Error('hashed_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.description) body.description = params.description;
      return wistiaApi('PUT', `/medias/${params.hashed_id}`, creds.api_key, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
