/**
 * OpenSky Network API Integration (free, optional auth)
 */
'use strict';
const https = require('https');

function osGet(path, creds) {
  return new Promise((resolve, reject) => {
    const authHeader = (creds && creds.username && creds.password)
      ? { 'Authorization': 'Basic ' + Buffer.from(`${creds.username}:${creds.password}`).toString('base64') }
      : {};
    const opts = { method: 'GET', hostname: 'opensky-network.org', path: `/api${path}`, headers: { 'Accept': 'application/json', ...authHeader } };
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
  id: 'opensky-network',
  name: 'OpenSky Network',
  category: 'travel',
  icon: 'Radar',
  description: 'Real-time and historical aircraft tracking via the OpenSky Network.',
  configFields: [
    { key: 'username', label: 'Username (optional)', type: 'text', required: false },
    { key: 'password', label: 'Password (optional)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await osGet('/states/all?lamin=45&lomin=5&lamax=48&lomax=14', creds); if (r.states !== undefined || r.time !== undefined) return { success: true, message: 'Connected to OpenSky Network' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_states: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.icao24 && { icao24: params.icao24 }), ...(params.lamin && { lamin: String(params.lamin), lomin: String(params.lomin), lamax: String(params.lamax), lomax: String(params.lomax) }) }).toString();
      return osGet(`/states/all?${qs}`, creds);
    },
    get_flights_by_aircraft: async (params, creds) => {
      if (!params.icao24 || !params.begin || !params.end) throw new Error('icao24, begin (unix), and end (unix) required');
      return osGet(`/flights/aircraft?icao24=${params.icao24}&begin=${params.begin}&end=${params.end}`, creds);
    },
    get_arrivals: async (params, creds) => {
      if (!params.airport || !params.begin || !params.end) throw new Error('airport (ICAO), begin, and end required');
      return osGet(`/flights/arrival?airport=${params.airport}&begin=${params.begin}&end=${params.end}`, creds);
    },
    get_departures: async (params, creds) => {
      if (!params.airport || !params.begin || !params.end) throw new Error('airport (ICAO), begin, and end required');
      return osGet(`/flights/departure?airport=${params.airport}&begin=${params.begin}&end=${params.end}`, creds);
    },
    get_tracks: async (params, creds) => {
      if (!params.icao24) throw new Error('icao24 required');
      const time = params.time || 0;
      return osGet(`/tracks/all?icao24=${params.icao24}&time=${time}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
