/**
 * US Census Bureau Geocoder Integration (free, no auth)
 */
'use strict';
const https = require('https');

function censusGet(path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'geocoding.geo.census.gov', path, headers: { 'Accept': 'application/json' } };
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
  id: 'census-geocoder',
  name: 'US Census Geocoder',
  category: 'realestate',
  icon: 'Map',
  description: 'Free US Census Bureau geocoder — address lookup, reverse geocoding, and census geography.',
  configFields: [],
  async connect(_creds) { this.credentials = {}; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await censusGet('/geocoder/locations/address?street=4600 Silver Hill Rd&city=Washington&state=DC&zip=20233&benchmark=Public_AR_Current&format=json'); if (r.result) return { success: true, message: 'Census Geocoder available' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    geocode_address: async (params, _creds) => {
      if (!params.street) throw new Error('street required');
      const qs = new URLSearchParams({ street: params.street, ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zip && { zip: params.zip }), benchmark: params.benchmark || 'Public_AR_Current', format: 'json' }).toString();
      return censusGet(`/geocoder/locations/address?${qs}`);
    },
    geocode_with_geography: async (params, _creds) => {
      if (!params.street) throw new Error('street required');
      const qs = new URLSearchParams({ street: params.street, ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zip && { zip: params.zip }), benchmark: 'Public_AR_Current', vintage: params.vintage || 'Current_Current', layers: params.layers || 'all', format: 'json' }).toString();
      return censusGet(`/geocoder/geographies/address?${qs}`);
    },
    reverse_geocode: async (params, _creds) => {
      if (!params.x || !params.y) throw new Error('x (longitude) and y (latitude) required');
      const qs = new URLSearchParams({ x: String(params.x), y: String(params.y), benchmark: 'Public_AR_Current', vintage: 'Current_Current', format: 'json' }).toString();
      return censusGet(`/geocoder/geographies/coordinates?${qs}`);
    },
    geocode_one_line: async (params, _creds) => {
      if (!params.address) throw new Error('address required (full one-line address)');
      const qs = new URLSearchParams({ address: params.address, benchmark: 'Public_AR_Current', format: 'json' }).toString();
      return censusGet(`/geocoder/locations/onelineaddress?${qs}`);
    },
    geocode_one_line_with_geography: async (params, _creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address, benchmark: 'Public_AR_Current', vintage: 'Current_Current', format: 'json' }).toString();
      return censusGet(`/geocoder/geographies/onelineaddress?${qs}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
