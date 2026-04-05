/**
 * Estated Property Data API Integration
 */
'use strict';
const https = require('https');

function estatedGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'apis.estated.com', path, headers: { 'Accept': 'application/json' } };
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
  id: 'estated',
  name: 'Estated',
  category: 'realestate',
  icon: 'Building2',
  description: 'Access Estated property data including ownership, valuation, and structure details.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await estatedGet(`/v4/property?token=${creds.api_key}&full_address=1+Infinite+Loop%2C+Cupertino%2C+CA+95014`, creds.api_key); if (r.error) return { success: false, message: r.error.message || 'Auth failed' }; return { success: true, message: 'Connected to Estated' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_property: async (params, creds) => {
      const qs = new URLSearchParams({ token: creds.api_key, ...(params.full_address && { full_address: params.full_address }), ...(params.street_number && { street_number: params.street_number }), ...(params.street_name && { street_name: params.street_name }), ...(params.unit_type && { unit_type: params.unit_type }), ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zip_code && { zip_code: params.zip_code }) }).toString();
      return estatedGet(`/v4/property?${qs}`, creds.api_key);
    },
    get_property_by_id: async (params, creds) => {
      if (!params.apn || !params.fips) throw new Error('apn (parcel number) and fips (county code) required');
      const qs = new URLSearchParams({ token: creds.api_key, apn: params.apn, fips: params.fips }).toString();
      return estatedGet(`/v4/property?${qs}`, creds.api_key);
    },
    get_automated_valuation: async (params, creds) => {
      if (!params.full_address) throw new Error('full_address required');
      const qs = new URLSearchParams({ token: creds.api_key, full_address: params.full_address }).toString();
      return estatedGet(`/v4/property?${qs}`, creds.api_key);
    },
    list_parcels: async (params, creds) => {
      if (!params.fips) throw new Error('fips county code required');
      const qs = new URLSearchParams({ token: creds.api_key, fips: params.fips, page: String(params.page || 1) }).toString();
      return estatedGet(`/v4/parcels?${qs}`, creds.api_key);
    },
    search_properties: async (params, creds) => {
      const qs = new URLSearchParams({ token: creds.api_key, ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zip_code && { zip_code: params.zip_code }) }).toString();
      return estatedGet(`/v4/property?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
