/**
 * Mapbox API Integration
 */
'use strict';
const https = require('https');

function mapboxRequest(path, accessToken) {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.mapbox.com', path: `${path}${separator}access_token=${encodeURIComponent(accessToken)}` };
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
  id: 'mapbox',
  name: 'Mapbox',
  category: 'maps',
  icon: 'Map',
  description: 'Geocode addresses, get directions, and manage map styles using the Mapbox API.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mapboxRequest('/geocoding/v5/mapbox.places/New%20York.json', creds.access_token); return { success: r.type === 'FeatureCollection', message: r.message || 'Connected to Mapbox' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    geocode: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ ...(params.country && { country: params.country }), ...(params.language && { language: params.language }), ...(params.limit && { limit: String(params.limit) }) }).toString();
      return mapboxRequest(`/geocoding/v5/mapbox.places/${encodeURIComponent(params.query)}.json${qs ? `?${qs}` : ''}`, creds.access_token);
    },
    reverse_geocode: async (params, creds) => {
      if (!params.lng || !params.lat) throw new Error('lng and lat required');
      return mapboxRequest(`/geocoding/v5/mapbox.places/${params.lng},${params.lat}.json`, creds.access_token);
    },
    get_directions: async (params, creds) => {
      if (!params.coordinates) throw new Error('coordinates required (semicolon-separated lng,lat pairs)');
      const profile = params.profile || 'driving';
      const qs = new URLSearchParams({ geometries: 'geojson', overview: params.overview || 'simplified', steps: String(params.steps || false) }).toString();
      return mapboxRequest(`/directions/v5/mapbox/${profile}/${encodeURIComponent(params.coordinates)}.json?${qs}`, creds.access_token);
    },
    list_styles: async (params, creds) => {
      const username = params.username || 'mapbox';
      return mapboxRequest(`/styles/v1/${username}`, creds.access_token);
    },
    get_static_map_url: async (params, creds) => {
      if (!params.lng || !params.lat || !params.zoom) throw new Error('lng, lat, and zoom required');
      const width = params.width || 600;
      const height = params.height || 400;
      const style = params.style || 'mapbox/streets-v12';
      const url = `https://api.mapbox.com/styles/v1/${style}/static/${params.lng},${params.lat},${params.zoom}/${width}x${height}?access_token=${creds.access_token}`;
      return { url };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
