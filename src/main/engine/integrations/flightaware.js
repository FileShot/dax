/**
 * FlightAware AeroAPI v4 Integration
 */
'use strict';
const https = require('https');

function faGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'aeroapi.flightaware.com', path: `/aeroapi${path}`, headers: { 'x-apikey': apiKey, 'Accept': 'application/json' } };
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
  id: 'flightaware',
  name: 'FlightAware',
  category: 'travel',
  icon: 'PlaneLanding',
  description: 'Real-time and historical flight data, airport info, and aircraft tracking via FlightAware AeroAPI.',
  configFields: [{ key: 'api_key', label: 'AeroAPI Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await faGet('/airports/KLAX', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to FlightAware AeroAPI' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_flight: async (params, creds) => {
      if (!params.ident) throw new Error('ident (flight number) required');
      const qs = params.start ? `?start=${params.start}&end=${params.end || ''}` : '';
      return faGet(`/flights/${params.ident}${qs}`, creds.api_key);
    },
    search_flights: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.query && { query: params.query }), ...(params.origin && { origin: params.origin }), ...(params.destination && { destination: params.destination }), ...(params.airline && { airline: params.airline }), max_pages: String(params.max_pages || 1) }).toString();
      return faGet(`/flights/search?${qs}`, creds.api_key);
    },
    get_airport: async (params, creds) => {
      if (!params.id) throw new Error('airport id (ICAO) required');
      return faGet(`/airports/${params.id}`, creds.api_key);
    },
    get_airline: async (params, creds) => {
      if (!params.id) throw new Error('airline id (ICAO/IATA) required');
      return faGet(`/operators/${params.id}`, creds.api_key);
    },
    get_aircraft: async (params, creds) => {
      if (!params.registration) throw new Error('registration (tail number) required');
      return faGet(`/aircraft/${params.registration}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
