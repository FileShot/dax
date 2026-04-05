/**
 * Pexels API Integration
 */
'use strict';
const https = require('https');

function pexelsApi(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.pexels.com', path, headers: { 'Authorization': apiKey } };
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
  id: 'pexels',
  name: 'Pexels',
  category: 'design',
  icon: 'Image',
  description: 'Search and access free stock photos and videos from Pexels.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pexelsApi('/v1/curated?per_page=1', creds.api_key); return { success: !!r.photos, message: r.photos ? 'Connected to Pexels' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_photos: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return pexelsApi(`/v1/search?query=${encodeURIComponent(params.query)}&per_page=${params.limit || 10}&page=${params.page || 1}`, creds.api_key);
    },
    get_photo: async (params, creds) => { if (!params.photo_id) throw new Error('photo_id required'); return pexelsApi(`/v1/photos/${params.photo_id}`, creds.api_key); },
    curated: async (params, creds) => pexelsApi(`/v1/curated?per_page=${params.limit || 10}&page=${params.page || 1}`, creds.api_key),
    search_videos: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return pexelsApi(`/videos/search?query=${encodeURIComponent(params.query)}&per_page=${params.limit || 10}&page=${params.page || 1}`, creds.api_key);
    },
    popular_videos: async (params, creds) => pexelsApi(`/videos/popular?per_page=${params.limit || 10}&page=${params.page || 1}`, creds.api_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
