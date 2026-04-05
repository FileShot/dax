/**
 * NASA APIs Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function nasaGet(path, apiKey) {
  const key = apiKey || 'DEMO_KEY';
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.nasa.gov', path: `${path}${sep}api_key=${key}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

function nasaImgGet(path) {
  const opts = { method: 'GET', hostname: 'images-api.nasa.gov', path, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'nasa',
  name: 'NASA',
  category: 'government',
  icon: 'Star',
  description: 'Access NASA APIs: Astronomy Picture of the Day, NEO asteroids, Mars photos, and image library.',
  configFields: [{ key: 'api_key', label: 'NASA API Key (use DEMO_KEY for testing)', type: 'text', required: false }],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await nasaGet('/planetary/apod', creds.api_key); if (r.error) return { success: false, message: r.error.message }; return { success: true, message: `Connected to NASA APIs — today: ${r.title}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_apod: async (params, creds) => {
      const qs = params.date ? `?date=${params.date}` : '';
      return nasaGet(`/planetary/apod${qs}`, creds.api_key);
    },
    search_images: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ q: params.query, ...(params.media_type && { media_type: params.media_type }), ...(params.year_start && { year_start: params.year_start }), ...(params.year_end && { year_end: params.year_end }) }).toString();
      return nasaImgGet(`/search?${qs}`);
    },
    get_neo: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.start_date && { start_date: params.start_date }), ...(params.end_date && { end_date: params.end_date }) }).toString();
      return nasaGet(`/neo/rest/v1/feed?${qs}`, creds.api_key);
    },
    get_earth_imagery: async (params, creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      const qs = new URLSearchParams({ lat: String(params.lat), lon: String(params.lon), ...(params.date && { date: params.date }), dim: String(params.dim || 0.025) }).toString();
      return nasaGet(`/planetary/earth/imagery?${qs}`, creds.api_key);
    },
    get_mars_photos: async (params, creds) => {
      const rover = params.rover || 'curiosity';
      const qs = new URLSearchParams({ sol: String(params.sol || 1000), ...(params.camera && { camera: params.camera }), page: String(params.page || 1) }).toString();
      return nasaGet(`/mars-photos/api/v1/rovers/${rover}/photos?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
