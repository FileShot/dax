/**
 * Google Maps Platform Integration
 */
'use strict';
const https = require('https');

function mapsRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'maps.googleapis.com', path: `${path}${separator}key=${encodeURIComponent(apiKey)}` };
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
  id: 'google-maps',
  name: 'Google Maps',
  category: 'maps',
  icon: 'MapPin',
  description: 'Geocode addresses, search places, and get directions using Google Maps Platform APIs.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mapsRequest('/maps/api/geocode/json?address=New+York', creds.api_key); return { success: r.status === 'OK', message: r.error_message || r.status || 'Connected to Google Maps' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    geocode: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = `address=${encodeURIComponent(params.address)}${params.region ? `&region=${encodeURIComponent(params.region)}` : ''}`;
      return mapsRequest(`/maps/api/geocode/json?${qs}`, creds.api_key);
    },
    reverse_geocode: async (params, creds) => {
      if (!params.lat || !params.lng) throw new Error('lat and lng required');
      return mapsRequest(`/maps/api/geocode/json?latlng=${params.lat},${params.lng}`, creds.api_key);
    },
    search_places: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = `query=${encodeURIComponent(params.query)}${params.location ? `&location=${params.location}` : ''}${params.radius ? `&radius=${params.radius}` : ''}`;
      return mapsRequest(`/maps/api/place/textsearch/json?${qs}`, creds.api_key);
    },
    get_directions: async (params, creds) => {
      if (!params.origin || !params.destination) throw new Error('origin and destination required');
      const qs = new URLSearchParams({ origin: params.origin, destination: params.destination, mode: params.mode || 'driving', ...(params.waypoints && { waypoints: params.waypoints }), ...(params.avoid && { avoid: params.avoid }) }).toString();
      return mapsRequest(`/maps/api/directions/json?${qs}`, creds.api_key);
    },
    distance_matrix: async (params, creds) => {
      if (!params.origins || !params.destinations) throw new Error('origins and destinations required');
      const qs = new URLSearchParams({ origins: params.origins, destinations: params.destinations, mode: params.mode || 'driving', units: params.units || 'metric' }).toString();
      return mapsRequest(`/maps/api/distancematrix/json?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
