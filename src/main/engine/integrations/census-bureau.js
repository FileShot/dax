/**
 * US Census Bureau Data API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function censusGet(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const keyParam = apiKey ? `${sep}key=${apiKey}` : '';
  const opts = { method: 'GET', hostname: 'api.census.gov', path: `/data${path}${keyParam}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'census-bureau',
  name: 'US Census Bureau',
  category: 'government',
  icon: 'BarChart2',
  description: 'Query US demographic data — population, income, education, and housing via the Census API.',
  configFields: [{ key: 'api_key', label: 'API Key (optional — request at api.census.gov/data/key_signup.html)', type: 'password', required: false }],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await censusGet('/2020/dec/pl?get=P1_001N&for=us:1', creds.api_key); if (Array.isArray(r)) return { success: true, message: 'Connected to Census Bureau API' }; if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to Census Bureau API' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_population: async (params, creds) => {
      const year = params.year || '2020';
      const geoFor = params.for || 'us:1';
      return censusGet(`/${year}/dec/pl?get=P1_001N&for=${encodeURIComponent(geoFor)}`, creds.api_key);
    },
    get_household_income: async (params, creds) => {
      const year = params.year || '2022';
      const geoFor = params.for || 'state:*';
      return censusGet(`/${year}/acs/acs1?get=NAME,B19013_001E&for=${encodeURIComponent(geoFor)}`, creds.api_key);
    },
    get_employment: async (params, creds) => {
      const year = params.year || '2022';
      const geoFor = params.for || 'state:*';
      return censusGet(`/${year}/acs/acs1?get=NAME,B23025_004E,B23025_005E&for=${encodeURIComponent(geoFor)}`, creds.api_key);
    },
    get_education: async (params, creds) => {
      const year = params.year || '2022';
      const geoFor = params.for || 'state:*';
      return censusGet(`/${year}/acs/acs1?get=NAME,B15003_022E,B15003_023E&for=${encodeURIComponent(geoFor)}`, creds.api_key);
    },
    get_housing: async (params, creds) => {
      const year = params.year || '2022';
      const geoFor = params.for || 'state:*';
      return censusGet(`/${year}/acs/acs1?get=NAME,B25077_001E&for=${encodeURIComponent(geoFor)}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
