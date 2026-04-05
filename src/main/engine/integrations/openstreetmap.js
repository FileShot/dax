/**
 * OpenStreetMap / Nominatim Integration
 */
'use strict';
const https = require('https');

function nominatimRequest(path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'nominatim.openstreetmap.org', path, headers: { 'User-Agent': 'Dax-Integration/1.0 (contact@dax.app)', 'Accept': 'application/json' } };
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
  id: 'openstreetmap',
  name: 'OpenStreetMap',
  category: 'maps',
  icon: 'Map',
  description: 'Geocode and search locations using the Nominatim OpenStreetMap API (no API key required).',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await nominatimRequest('/search?q=London&format=json&limit=1'); return { success: Array.isArray(r) && r.length > 0, message: 'Connected to Nominatim (OpenStreetMap)' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    geocode: async (params, creds) => {
      if (!params.q && !params.street && !params.city) throw new Error('q or structured address fields required');
      const qs = new URLSearchParams({ format: 'json', addressdetails: '1', limit: String(params.limit || 10), ...(params.q && { q: params.q }), ...(params.street && { street: params.street }), ...(params.city && { city: params.city }), ...(params.country && { country: params.country }), ...(params.postalcode && { postalcode: params.postalcode }), ...(params.countrycodes && { countrycodes: params.countrycodes }) }).toString();
      return nominatimRequest(`/search?${qs}`);
    },
    reverse_geocode: async (params, creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      const qs = new URLSearchParams({ format: 'json', lat: String(params.lat), lon: String(params.lon), addressdetails: '1', zoom: String(params.zoom || 18) }).toString();
      return nominatimRequest(`/reverse?${qs}`);
    },
    search: async (params, creds) => {
      if (!params.q) throw new Error('q required');
      const qs = new URLSearchParams({ format: 'json', q: params.q, limit: String(params.limit || 10), addressdetails: '1', ...(params.viewbox && { viewbox: params.viewbox, bounded: '1' }) }).toString();
      return nominatimRequest(`/search?${qs}`);
    },
    lookup: async (params, creds) => {
      if (!params.osm_ids) throw new Error('osm_ids required (e.g. "N238873600,W67948")');
      return nominatimRequest(`/lookup?osm_ids=${encodeURIComponent(params.osm_ids)}&format=json&addressdetails=1`);
    },
    get_details: async (params, creds) => {
      if (!params.place_id) throw new Error('place_id required');
      return nominatimRequest(`/details?place_id=${params.place_id}&format=json`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
