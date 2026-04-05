/**
 * Yelp Fusion API Integration
 */
'use strict';
const https = require('https');

function yelpGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.yelp.com', path: `/v3${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } };
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
  id: 'yelp-fusion',
  name: 'Yelp Fusion',
  category: 'food',
  icon: 'Star',
  description: 'Search local businesses, read reviews, and find events using Yelp Fusion API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await yelpGet('/businesses/search?term=coffee&location=San+Francisco&limit=1', creds.api_key); if (r.error) return { success: false, message: r.error.description }; return { success: true, message: 'Connected to Yelp Fusion' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_businesses: async (params, creds) => {
      if (!params.term && !params.location && !params.latitude) throw new Error('term and location (or coordinates) required');
      const qs = new URLSearchParams({ ...(params.term && { term: params.term }), ...(params.location && { location: params.location }), ...(params.latitude && { latitude: String(params.latitude), longitude: String(params.longitude) }), limit: String(params.limit || 20), offset: String(params.offset || 0), ...(params.categories && { categories: params.categories }), ...(params.price && { price: params.price }), ...(params.open_now && { open_now: 'true' }) }).toString();
      return yelpGet(`/businesses/search?${qs}`, creds.api_key);
    },
    get_business: async (params, creds) => {
      if (!params.id) throw new Error('business id required');
      return yelpGet(`/businesses/${params.id}`, creds.api_key);
    },
    get_reviews: async (params, creds) => {
      if (!params.id) throw new Error('business id required');
      return yelpGet(`/businesses/${params.id}/reviews?limit=${params.limit || 20}`, creds.api_key);
    },
    search_events: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.location && { location: params.location }), ...(params.latitude && { latitude: String(params.latitude), longitude: String(params.longitude) }), ...(params.categories && { categories: params.categories }), limit: String(params.limit || 20) }).toString();
      return yelpGet(`/events?${qs}`, creds.api_key);
    },
    autocomplete: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const qs = new URLSearchParams({ text: params.text, ...(params.latitude && { latitude: String(params.latitude), longitude: String(params.longitude) }) }).toString();
      return yelpGet(`/autocomplete?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
