/**
 * Data USA Open Data Platform Integration (free, no auth)
 */
'use strict';
const https = require('https');

function datausaGet(path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'datausa.io', path, headers: { 'Accept': 'application/json' } };
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
  id: 'datausa',
  name: 'Data USA',
  category: 'realestate',
  icon: 'Database',
  description: 'Access US Census demographic, economic, and housing data via Data USA (free, no auth).',
  configFields: [],
  async connect(_creds) { this.credentials = {}; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await datausaGet('/api/data?drilldowns=Nation&measures=Population&year=latest'); if (r.data) return { success: true, message: 'Data USA API available' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_population: async (params, _creds) => {
      const level = params.level || 'State';
      const qs = new URLSearchParams({ drilldowns: level, measures: 'Population', year: params.year || 'latest', ...(params.geo && { 'Geography': params.geo }) }).toString();
      return datausaGet(`/api/data?${qs}`);
    },
    get_income: async (params, _creds) => {
      const qs = new URLSearchParams({ drilldowns: params.level || 'State', measures: 'Household Income', year: params.year || 'latest' }).toString();
      return datausaGet(`/api/data?${qs}`);
    },
    get_housing_value: async (params, _creds) => {
      const qs = new URLSearchParams({ drilldowns: params.level || 'State', measures: 'Property Value', year: params.year || 'latest' }).toString();
      return datausaGet(`/api/data?${qs}`);
    },
    get_employment: async (params, _creds) => {
      const qs = new URLSearchParams({ drilldowns: params.level || 'State', measures: 'Employed', year: params.year || 'latest' }).toString();
      return datausaGet(`/api/data?${qs}`);
    },
    search_geography: async (params, _creds) => {
      if (!params.name) throw new Error('name required (city, state, or zip)');
      return datausaGet(`/api/geo/search?q=${encodeURIComponent(params.name)}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
