/**
 * Foursquare Places API v3 Integration
 */
'use strict';
const https = require('https');

function fsqGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.foursquare.com', path: `/v3${path}`, headers: { 'Authorization': apiKey, 'Accept': 'application/json' } };
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
  id: 'foursquare',
  name: 'Foursquare',
  category: 'travel',
  icon: 'MapPin',
  description: 'Search places, get venue details, tips, and photos via Foursquare Places API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fsqGet('/places/search?query=coffee&near=New+York', creds.api_key); if (r.message) return { success: false, message: r.message }; return { success: true, message: 'Connected to Foursquare' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_places: async (params, creds) => {
      if (!params.near && !params.ll) throw new Error('near (city name) or ll (lat,lng) required');
      const qs = new URLSearchParams({ ...(params.query && { query: params.query }), ...(params.near && { near: params.near }), ...(params.ll && { ll: params.ll }), limit: String(params.limit || 20), ...(params.categories && { categories: params.categories }), ...(params.radius && { radius: String(params.radius) }) }).toString();
      return fsqGet(`/places/search?${qs}`, creds.api_key);
    },
    get_place: async (params, creds) => {
      if (!params.fsq_id) throw new Error('fsq_id required');
      return fsqGet(`/places/${params.fsq_id}`, creds.api_key);
    },
    get_tips: async (params, creds) => {
      if (!params.fsq_id) throw new Error('fsq_id required');
      return fsqGet(`/places/${params.fsq_id}/tips?limit=${params.limit || 10}`, creds.api_key);
    },
    get_photos: async (params, creds) => {
      if (!params.fsq_id) throw new Error('fsq_id required');
      return fsqGet(`/places/${params.fsq_id}/photos?limit=${params.limit || 10}`, creds.api_key);
    },
    get_nearby: async (params, creds) => {
      if (!params.ll) throw new Error('ll (lat,lng) required');
      const qs = new URLSearchParams({ ll: params.ll, limit: String(params.limit || 20), ...(params.query && { query: params.query }), ...(params.radius && { radius: String(params.radius) }) }).toString();
      return fsqGet(`/places/nearby?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
