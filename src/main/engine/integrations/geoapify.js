/**
 * Geoapify Places & Geocoding API Integration
 */
'use strict';
const https = require('https');

function geoGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.geoapify.com', path: `${path}${sep}apiKey=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'geoapify',
  name: 'Geoapify',
  category: 'travel',
  icon: 'Navigation',
  description: 'Geocoding, routing, place search, and isoline mapping via Geoapify API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await geoGet('/v1/geocode/search?text=New+York', creds.api_key); if (r.type === 'FeatureCollection') return { success: true, message: 'Connected to Geoapify' }; if (r.message) return { success: false, message: r.message }; return { success: true, message: 'Connected to Geoapify' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    geocode_address: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const qs = new URLSearchParams({ text: params.text, ...(params.lang && { lang: params.lang }), limit: String(params.limit || 5) }).toString();
      return geoGet(`/v1/geocode/search?${qs}`, creds.api_key);
    },
    reverse_geocode: async (params, creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      return geoGet(`/v1/geocode/reverse?lat=${params.lat}&lon=${params.lon}`, creds.api_key);
    },
    get_route: async (params, creds) => {
      if (!params.waypoints) throw new Error('waypoints required (array of "lat,lon" strings)');
      const wp = Array.isArray(params.waypoints) ? params.waypoints.join('|') : params.waypoints;
      const qs = new URLSearchParams({ waypoints: wp, mode: params.mode || 'drive' }).toString();
      return geoGet(`/v1/routing?${qs}`, creds.api_key);
    },
    search_places: async (params, creds) => {
      if (!params.categories && !params.name) throw new Error('categories or name required');
      const qs = new URLSearchParams({ ...(params.categories && { categories: params.categories }), ...(params.name && { name: params.name }), ...(params.filter && { filter: params.filter }), ...(params.bias && { bias: params.bias }), limit: String(params.limit || 20) }).toString();
      return geoGet(`/v2/places?${qs}`, creds.api_key);
    },
    get_isoline: async (params, creds) => {
      if (!params.lat || !params.lon || !params.type) throw new Error('lat, lon, and type (time/distance) required');
      const qs = new URLSearchParams({ lat: String(params.lat), lon: String(params.lon), type: params.type, mode: params.mode || 'drive', range: String(params.range || 600) }).toString();
      return geoGet(`/v1/isoline?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
