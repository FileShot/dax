/**
 * World Bank Open Data API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function wbGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.worldbank.org', path: `/v2${path}${sep}format=json&per_page=${50}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'world-bank',
  name: 'World Bank',
  category: 'government',
  icon: 'Globe',
  description: 'Access World Bank open data: country indicators, GDP, population, poverty metrics.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await wbGet('/country/US'); if (Array.isArray(r) && r[1]) return { success: true, message: 'Connected to World Bank API' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_country: async (params, _creds) => {
      if (!params.country_code) throw new Error('country_code required (ISO 2-letter, e.g. "US")');
      return wbGet(`/country/${params.country_code}`);
    },
    get_indicator: async (params, _creds) => {
      if (!params.country_code || !params.indicator) throw new Error('country_code and indicator required (e.g. NY.GDP.MKTP.CD)');
      const qs = params.date ? `?date=${params.date}` : '';
      return wbGet(`/country/${params.country_code}/indicator/${params.indicator}${qs}`);
    },
    search_indicators: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      return wbGet(`/indicator?source=2&mrv=1&format=json&per_page=20&q=${encodeURIComponent(params.query)}`);
    },
    get_country_indicator: async (params, _creds) => {
      if (!params.indicator) throw new Error('indicator required');
      const country = params.country_code || 'all';
      return wbGet(`/country/${country}/indicator/${params.indicator}?mrv=${params.mrv || 5}`);
    },
    list_topics: async (params, _creds) => {
      return wbGet('/topic');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
