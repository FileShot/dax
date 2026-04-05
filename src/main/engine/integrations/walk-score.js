/**
 * Walk Score Walkability API Integration
 */
'use strict';
const https = require('https');

function walkscoreGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.walkscore.com', path, headers: { 'Accept': 'application/json' } };
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
  id: 'walk-score',
  name: 'Walk Score',
  category: 'realestate',
  icon: 'Footprints',
  description: 'Get Walk Score, Transit Score, and Bike Score for any address.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await walkscoreGet(`/score?format=json&wsapikey=${creds.api_key}&lat=47.6085&lon=-122.3395&address=1119 8th Avenue Seattle WA 98101`, creds.api_key); if (r.status !== 1) return { success: false, message: r.description || 'Walk Score API failed' }; return { success: true, message: 'Connected to Walk Score API' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_score: async (params, creds) => {
      if (!params.lat || !params.lon || !params.address) throw new Error('lat, lon, and address required');
      const qs = new URLSearchParams({ format: 'json', wsapikey: creds.api_key, lat: String(params.lat), lon: String(params.lon), address: params.address, transit: '1', bike: '1' }).toString();
      return walkscoreGet(`/score?${qs}`, creds.api_key);
    },
    get_walk_score: async (params, creds) => {
      if (!params.lat || !params.lon || !params.address) throw new Error('lat, lon, and address required');
      const qs = new URLSearchParams({ format: 'json', wsapikey: creds.api_key, lat: String(params.lat), lon: String(params.lon), address: params.address }).toString();
      return walkscoreGet(`/score?${qs}`, creds.api_key);
    },
    get_transit_score: async (params, creds) => {
      if (!params.lat || !params.lon || !params.address) throw new Error('lat, lon, and address required');
      const qs = new URLSearchParams({ format: 'json', wsapikey: creds.api_key, lat: String(params.lat), lon: String(params.lon), address: params.address, transit: '1' }).toString();
      return walkscoreGet(`/score?${qs}`, creds.api_key);
    },
    get_bike_score: async (params, creds) => {
      if (!params.lat || !params.lon || !params.address) throw new Error('lat, lon, and address required');
      const qs = new URLSearchParams({ format: 'json', wsapikey: creds.api_key, lat: String(params.lat), lon: String(params.lon), address: params.address, bike: '1' }).toString();
      return walkscoreGet(`/score?${qs}`, creds.api_key);
    },
    batch_scores: async (params, creds) => {
      if (!Array.isArray(params.locations) || params.locations.length === 0) throw new Error('locations array required [{lat, lon, address}]');
      const results = await Promise.all(params.locations.map(loc => {
        const qs = new URLSearchParams({ format: 'json', wsapikey: creds.api_key, lat: String(loc.lat), lon: String(loc.lon), address: loc.address, transit: '1', bike: '1' }).toString();
        return walkscoreGet(`/score?${qs}`, creds.api_key).then(r => ({ ...r, address: loc.address }));
      }));
      return { results };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
