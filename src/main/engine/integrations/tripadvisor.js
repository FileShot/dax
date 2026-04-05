/**
 * TripAdvisor Content API Integration
 */
'use strict';
const https = require('https');

function taGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.content.tripadvisor.com', path: `/api/v1${path}${sep}key=${apiKey}`, headers: { 'Accept': 'application/json', 'Referer': 'https://localhost' } };
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
  id: 'tripadvisor',
  name: 'TripAdvisor',
  category: 'travel',
  icon: 'Map',
  description: 'Search and get details for travel locations, hotels, restaurants, and attractions.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await taGet('/location/search?searchQuery=Paris&language=en', creds.api_key); if (r.error) return { success: false, message: r.error.message }; return { success: true, message: 'Connected to TripAdvisor' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_locations: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ searchQuery: params.query, language: params.language || 'en', ...(params.category && { category: params.category }) }).toString();
      return taGet(`/location/search?${qs}`, creds.api_key);
    },
    get_location_details: async (params, creds) => {
      if (!params.location_id) throw new Error('location_id required');
      return taGet(`/location/${params.location_id}/details?language=${params.language || 'en'}`, creds.api_key);
    },
    get_location_photos: async (params, creds) => {
      if (!params.location_id) throw new Error('location_id required');
      return taGet(`/location/${params.location_id}/photos?language=${params.language || 'en'}&limit=${params.limit || 10}`, creds.api_key);
    },
    get_location_reviews: async (params, creds) => {
      if (!params.location_id) throw new Error('location_id required');
      return taGet(`/location/${params.location_id}/reviews?language=${params.language || 'en'}&limit=${params.limit || 10}`, creds.api_key);
    },
    get_nearby: async (params, creds) => {
      if (!params.latLong) throw new Error('latLong required (e.g. "40.7128,-74.0060")');
      const qs = new URLSearchParams({ latLong: params.latLong, language: params.language || 'en', ...(params.category && { category: params.category }), ...(params.radius && { radius: String(params.radius) }) }).toString();
      return taGet(`/location/nearby_search?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
