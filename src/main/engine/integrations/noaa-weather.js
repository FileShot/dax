/**
 * NOAA / National Weather Service API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function nwsGet(path) {
  const opts = { method: 'GET', hostname: 'api.weather.gov', path, headers: { 'Accept': 'application/geo+json,application/json', 'User-Agent': 'DaxAgent/1.0' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'noaa-weather',
  name: 'NOAA Weather',
  category: 'government',
  icon: 'Cloud',
  description: 'Get US weather forecasts, alerts, and observations from the National Weather Service API.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await nwsGet('/points/39.7456,-97.0892'); if (r.properties) return { success: true, message: 'Connected to National Weather Service' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_forecast: async (params, _creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      const point = await nwsGet(`/points/${params.lat},${params.lon}`);
      if (!point.properties?.forecast) throw new Error('Unable to resolve forecast URL for location');
      const forecastUrl = new URL(point.properties.forecast);
      return nwsGet(forecastUrl.pathname);
    },
    get_observations: async (params, _creds) => {
      if (!params.station_id) throw new Error('station_id required (e.g. KORD)');
      const limit = params.limit || 10;
      return nwsGet(`/stations/${params.station_id}/observations?limit=${limit}`);
    },
    get_alerts: async (params, _creds) => {
      const qs = new URLSearchParams({ ...(params.area && { area: params.area }), ...(params.status && { status: params.status }), ...(params.event && { event: params.event }), limit: String(params.limit || 100) }).toString();
      return nwsGet(`/alerts/active?${qs}`);
    },
    get_stations: async (params, _creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      const point = await nwsGet(`/points/${params.lat},${params.lon}`);
      if (!point.properties?.observationStations) throw new Error('Unable to resolve stations URL');
      const stationsUrl = new URL(point.properties.observationStations);
      return nwsGet(stationsUrl.pathname);
    },
    get_gridpoint: async (params, _creds) => {
      if (!params.wfo || !params.x || !params.y) throw new Error('wfo, x, and y required (Weather Forecast Office + grid coords)');
      return nwsGet(`/gridpoints/${params.wfo}/${params.x},${params.y}/forecast`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
