/**
 * Realty Mole Property Data API Integration
 */
'use strict';
const https = require('https');

function realtymoleGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'realty-mole-property-api.p.rapidapi.com', path, headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'realty-mole-property-api.p.rapidapi.com', 'Accept': 'application/json' } };
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
  id: 'realty-mole',
  name: 'Realty Mole',
  category: 'realestate',
  icon: 'MapPin',
  description: 'Access Realty Mole property data, rent estimates, comparable sales and market stats.',
  configFields: [{ key: 'api_key', label: 'RapidAPI Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('RapidAPI key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await realtymoleGet('/properties?address=5500 Grand Lake Drive&city=San Antonio&state=TX&zipCode=78244', creds.api_key); if (r.message) return { success: false, message: r.message }; return { success: true, message: 'Connected to Realty Mole' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_property: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address, ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zipCode && { zipCode: params.zipCode }) }).toString();
      return realtymoleGet(`/properties?${qs}`, creds.api_key);
    },
    get_rent_estimate: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address, ...(params.bedrooms && { bedrooms: String(params.bedrooms) }), ...(params.bathrooms && { bathrooms: String(params.bathrooms) }) }).toString();
      return realtymoleGet(`/rentalPrice?${qs}`, creds.api_key);
    },
    get_comparable_rentals: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address, ...(params.radius && { radius: String(params.radius) }), ...(params.bedrooms && { bedrooms: String(params.bedrooms) }) }).toString();
      return realtymoleGet(`/comparable?${qs}`, creds.api_key);
    },
    get_comparable_sales: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address, ...(params.radius && { radius: String(params.radius) }) }).toString();
      return realtymoleGet(`/salePrice?${qs}`, creds.api_key);
    },
    get_market_statistics: async (params, creds) => {
      if (!params.zipCode && !params.city) throw new Error('zipCode or city required');
      const qs = new URLSearchParams({ ...(params.zipCode && { zipCode: params.zipCode }), ...(params.city && { city: params.city }), ...(params.state && { state: params.state }) }).toString();
      return realtymoleGet(`/zipCodes/${params.zipCode || ''}?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
