/**
 * AirNow (EPA Air Quality) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function airGet(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'www.airnowapi.org', path: `/aq${path}${sep}API_KEY=${apiKey}&format=application/json`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'epa-airnow',
  name: 'AirNow (EPA)',
  category: 'government',
  icon: 'Wind',
  description: 'Get real-time and forecast air quality index (AQI) data from EPA AirNow.',
  configFields: [{ key: 'api_key', label: 'API Key (register at docs.airnowapi.org)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await airGet('/observation/zipCode/current/?zipCode=94105&distance=25', creds.api_key); if (!Array.isArray(r)) return { success: false, message: 'Unexpected response or invalid key' }; return { success: true, message: 'Connected to AirNow (EPA)' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_observation: async (params, creds) => {
      if (!params.zipCode && !params.latitude) throw new Error('zipCode or latitude/longitude required');
      if (params.zipCode) {
        return airGet(`/observation/zipCode/current/?zipCode=${params.zipCode}&distance=${params.distance || 25}`, creds.api_key);
      }
      return airGet(`/observation/latLong/current/?latitude=${params.latitude}&longitude=${params.longitude}&distance=${params.distance || 25}`, creds.api_key);
    },
    get_forecast: async (params, creds) => {
      if (!params.zipCode && !params.latitude) throw new Error('zipCode or latitude/longitude required');
      const date = params.date || new Date().toISOString().split('T')[0];
      if (params.zipCode) {
        return airGet(`/forecast/zipCode/?zipCode=${params.zipCode}&date=${date}&distance=${params.distance || 25}`, creds.api_key);
      }
      return airGet(`/forecast/latLong/?latitude=${params.latitude}&longitude=${params.longitude}&date=${date}&distance=${params.distance || 25}`, creds.api_key);
    },
    get_historical: async (params, creds) => {
      if (!params.zipCode || !params.date) throw new Error('zipCode and date required (YYYY-MM-DD)');
      return airGet(`/observation/zipCode/historical/?zipCode=${params.zipCode}&date=${params.date}T00-0000&distance=${params.distance || 25}`, creds.api_key);
    },
    get_reporting_area: async (params, creds) => {
      if (!params.latitude || !params.longitude) throw new Error('latitude and longitude required');
      return airGet(`/observation/latLong/current/?latitude=${params.latitude}&longitude=${params.longitude}&distance=${params.distance || 25}`, creds.api_key);
    },
    by_zip: async (params, creds) => {
      if (!params.zipCode) throw new Error('zipCode required');
      return airGet(`/observation/zipCode/current/?zipCode=${params.zipCode}&distance=${params.distance || 25}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
