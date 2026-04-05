/**
 * Unsplash API Integration
 */
'use strict';
const https = require('https');

function unsplashApi(method, path, accessKey) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.unsplash.com', path, headers: { 'Authorization': `Client-ID ${accessKey}`, 'Accept-Version': 'v1' } };
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
  id: 'unsplash',
  name: 'Unsplash',
  category: 'design',
  icon: 'Camera',
  description: 'Search and access free high-resolution photos from Unsplash.',
  configFields: [
    { key: 'access_key', label: 'Access Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_key) throw new Error('Access key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await unsplashApi('GET', '/photos?per_page=1', creds.access_key); return { success: Array.isArray(r), message: Array.isArray(r) ? 'Connected to Unsplash' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_photos: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return unsplashApi('GET', `/search/photos?query=${encodeURIComponent(params.query)}&per_page=${params.limit || 10}&page=${params.page || 1}`, creds.access_key);
    },
    get_photo: async (params, creds) => { if (!params.photo_id) throw new Error('photo_id required'); return unsplashApi('GET', `/photos/${params.photo_id}`, creds.access_key); },
    list_photos: async (params, creds) => unsplashApi('GET', `/photos?per_page=${params.limit || 10}&page=${params.page || 1}&order_by=${params.order || 'latest'}`, creds.access_key),
    get_random: async (params, creds) => {
      const query = params.query ? `&query=${encodeURIComponent(params.query)}` : '';
      return unsplashApi('GET', `/photos/random?count=${params.count || 1}${query}`, creds.access_key);
    },
    list_collections: async (params, creds) => unsplashApi('GET', `/collections?per_page=${params.limit || 10}&page=${params.page || 1}`, creds.access_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
