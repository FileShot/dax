/**
 * WHO Global Health Observatory (GHO) API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function whoReq(path) {
  return makeRequest({ method: 'GET', hostname: 'ghoapi.azureedge.net', path, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'who-gho',
  name: 'WHO Global Health Observatory',
  category: 'health',
  icon: 'Globe',
  description: 'Access global health statistics from the WHO Global Health Observatory (GHO) OData API.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await whoReq('/api/Indicator?$top=1'); return { success: true, message: 'WHO GHO API reachable' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_indicators: async (params, creds) => {
      const qs = params.filter ? `?$filter=contains(IndicatorName,'${params.filter}')&$top=${params.top || 20}` : `?$top=${params.top || 20}`;
      return whoReq(`/api/Indicator${qs}`);
    },
    get_indicator_data: async (params, creds) => {
      if (!params.indicator_code) throw new Error('indicator_code required (e.g. WHOSIS_000001)');
      const filters = [];
      if (params.country) filters.push(`SpatialDim eq '${params.country}'`);
      if (params.year) filters.push(`TimeDim eq ${params.year}`);
      const qs = filters.length ? `?$filter=${filters.join(' and ')}` : '';
      return whoReq(`/api/${params.indicator_code}${qs}`);
    },
    list_countries: async (params, creds) => {
      return whoReq('/api/DIMENSION/COUNTRY/DimensionValues');
    },
    get_mortality: async (params, creds) => {
      const country = params.country || '';
      const qs = country ? `?$filter=SpatialDim eq '${country}'` : '';
      return whoReq(`/api/WHOSIS_000001${qs}`);
    },
    get_life_expectancy: async (params, creds) => {
      const country = params.country || '';
      const qs = country ? `?$filter=SpatialDim eq '${country}'` : '';
      return whoReq(`/api/WHOSIS_000015${qs}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
