/**
 * Regrid Parcel Data API Integration
 */
'use strict';
const https = require('https');

function regridGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'app.regrid.com', path, headers: { 'Authorization': `Token token=${apiKey}`, 'Accept': 'application/json' } };
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
  id: 'regrid',
  name: 'Regrid',
  category: 'realestate',
  icon: 'Grid',
  description: 'Access Regrid parcel data — ownership, assessments, and geographic boundaries.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await regridGet('/api/v1/parcels/search?query=1+Infinite+Loop+Cupertino+CA&return_count_only=true', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to Regrid' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_parcels: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, limit: String(params.limit || 10) }).toString();
      return regridGet(`/api/v1/parcels/search?${qs}`, creds.api_key);
    },
    get_parcel: async (params, creds) => {
      if (!params.path) throw new Error('path required (e.g. /us/mi/wayne/detroit)');
      const qs = new URLSearchParams({ path: params.path, return_geometry: params.return_geometry ? 'true' : 'false' }).toString();
      return regridGet(`/api/v1/parcel?${qs}`, creds.api_key);
    },
    get_parcel_by_ll_uuid: async (params, creds) => {
      if (!params.ll_uuid) throw new Error('ll_uuid required');
      return regridGet(`/api/v1/parcels/${params.ll_uuid}`, creds.api_key);
    },
    get_parcel_by_coordinates: async (params, creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      const qs = new URLSearchParams({ lat: String(params.lat), lon: String(params.lon), return_custom: params.return_custom || '', return_field: params.return_field || '' }).toString();
      return regridGet(`/api/v1/parcel?${qs}`, creds.api_key);
    },
    get_county_stats: async (params, creds) => {
      if (!params.path) throw new Error('path required (e.g. /us/mi/wayne)');
      return regridGet(`/api/v1/county?path=${encodeURIComponent(params.path)}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
