/**
 * Flickr Photo Sharing Integration
 */
'use strict';
const https = require('https');

function flickrGet(method, apiKey, params) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ method, api_key: apiKey, format: 'json', nojsoncallback: '1', ...params }).toString();
    const opts = { method: 'GET', hostname: 'api.flickr.com', path: `/services/rest/?${qs}`, headers: { 'Accept': 'application/json' } };
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
  id: 'flickr',
  name: 'Flickr',
  category: 'social',
  icon: 'Camera',
  description: 'Search and retrieve photos, albums, and user info from Flickr.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await flickrGet('flickr.test.echo', creds.api_key, {}); if (r.stat === 'fail') return { success: false, message: r.message }; return { success: true, message: 'Connected to Flickr API' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    photos_search: async (params, creds) => {
      if (!params.text && !params.user_id && !params.tags) throw new Error('text, user_id, or tags required');
      return flickrGet('flickr.photos.search', creds.api_key, { text: params.text || '', user_id: params.user_id || '', tags: params.tags || '', per_page: String(params.per_page || 20), page: String(params.page || 1), extras: 'url_m,url_l,owner_name,date_taken' });
    },
    get_photo_info: async (params, creds) => {
      if (!params.photo_id) throw new Error('photo_id required');
      return flickrGet('flickr.photos.getInfo', creds.api_key, { photo_id: params.photo_id });
    },
    get_user_info: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return flickrGet('flickr.people.getInfo', creds.api_key, { user_id: params.user_id });
    },
    get_photoset_photos: async (params, creds) => {
      if (!params.photoset_id || !params.user_id) throw new Error('photoset_id and user_id required');
      return flickrGet('flickr.photosets.getPhotos', creds.api_key, { photoset_id: params.photoset_id, user_id: params.user_id, per_page: String(params.per_page || 20), extras: 'url_m' });
    },
    get_recent: async (params, creds) => {
      return flickrGet('flickr.photos.getRecent', creds.api_key, { count: String(params.count || 20), extras: 'url_m,owner_name' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
