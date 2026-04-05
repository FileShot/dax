/**
 * AviationStack API Integration
 */
'use strict';
const https = require('https');

function avGet(path, accessKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.aviationstack.com', path: `/v1${path}${sep}access_key=${accessKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'aviationstack',
  name: 'AviationStack',
  category: 'travel',
  icon: 'PlaneTakeoff',
  description: 'Real-time flight status, airline, airport, and route data via AviationStack.',
  configFields: [{ key: 'access_key', label: 'Access Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_key) throw new Error('access_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await avGet('/flights?limit=1', creds.access_key); if (r.error) return { success: false, message: r.error.info }; return { success: true, message: 'Connected to AviationStack' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_flights: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 100), offset: String(params.offset || 0), ...(params.flight_status && { flight_status: params.flight_status }), ...(params.flight_iata && { flight_iata: params.flight_iata }), ...(params.airline_iata && { airline_iata: params.airline_iata }), ...(params.dep_iata && { dep_iata: params.dep_iata }), ...(params.arr_iata && { arr_iata: params.arr_iata }) }).toString();
      return avGet(`/flights?${qs}`, creds.access_key);
    },
    get_airlines: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 100), ...(params.airline_name && { airline_name: params.airline_name }), ...(params.iata_code && { iata_code: params.iata_code }) }).toString();
      return avGet(`/airlines?${qs}`, creds.access_key);
    },
    get_airports: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 100), ...(params.airport_name && { airport_name: params.airport_name }), ...(params.iata_code && { iata_code: params.iata_code }), ...(params.country_iso2 && { country_iso2: params.country_iso2 }) }).toString();
      return avGet(`/airports?${qs}`, creds.access_key);
    },
    get_routes: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 100), ...(params.airline_iata && { airline_iata: params.airline_iata }), ...(params.dep_iata && { dep_iata: params.dep_iata }), ...(params.arr_iata && { arr_iata: params.arr_iata }) }).toString();
      return avGet(`/routes?${qs}`, creds.access_key);
    },
    get_countries: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 100), ...(params.country_name && { country_name: params.country_name }), ...(params.country_iso2 && { country_iso2: params.country_iso2 }) }).toString();
      return avGet(`/countries?${qs}`, creds.access_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
