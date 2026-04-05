/**
 * OpenTripMap Tourist Objects API Integration
 */
'use strict';
const https = require('https');

function otmGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.opentripmap.com', path: `/0.1/en/places${path}${sep}apikey=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'opentripmap',
  name: 'OpenTripMap',
  category: 'travel',
  icon: 'Landmark',
  description: 'Discover tourist attractions, landmarks, and points of interest worldwide.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await otmGet('/autosuggest?name=Eiffel&limit=1', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to OpenTripMap' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_places: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const qs = new URLSearchParams({ name: params.name, limit: String(params.limit || 10), ...(params.kinds && { kinds: params.kinds }) }).toString();
      return otmGet(`/autosuggest?${qs}`, creds.api_key);
    },
    get_place: async (params, creds) => {
      if (!params.xid) throw new Error('xid required');
      return otmGet(`/xid/${params.xid}`, creds.api_key);
    },
    get_places_bbox: async (params, creds) => {
      if (!params.lon_min || !params.lat_min || !params.lon_max || !params.lat_max) throw new Error('lon_min, lat_min, lon_max, lat_max required');
      const qs = new URLSearchParams({ lon_min: String(params.lon_min), lat_min: String(params.lat_min), lon_max: String(params.lon_max), lat_max: String(params.lat_max), limit: String(params.limit || 50), ...(params.kinds && { kinds: params.kinds }), ...(params.rate && { rate: String(params.rate) }) }).toString();
      return otmGet(`/bbox?${qs}`, creds.api_key);
    },
    get_places_radius: async (params, creds) => {
      if (!params.lat || !params.lon || !params.radius) throw new Error('lat, lon, and radius required');
      const qs = new URLSearchParams({ lat: String(params.lat), lon: String(params.lon), radius: String(params.radius), limit: String(params.limit || 50), ...(params.kinds && { kinds: params.kinds }), ...(params.rate && { rate: String(params.rate) }) }).toString();
      return otmGet(`/radius?${qs}`, creds.api_key);
    },
    get_categories: async (params, creds) => {
      return otmGet('/categories', creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
