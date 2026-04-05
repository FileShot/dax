/**
 * RentCast Property & Rental Data API Integration
 */
'use strict';
const https = require('https');

function rentcastGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.rentcast.io', path: `/v1${path}`, headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' } };
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
  id: 'rentcast',
  name: 'RentCast',
  category: 'realestate',
  icon: 'DollarSign',
  description: 'Access RentCast rental comps, AVM, market statistics, and property records.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rentcastGet('/markets?zipCode=78701', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to RentCast' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_property: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address }).toString();
      return rentcastGet(`/properties?${qs}`, creds.api_key);
    },
    get_rent_estimate: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address, ...(params.bedrooms && { bedrooms: String(params.bedrooms) }), ...(params.bathrooms && { bathrooms: String(params.bathrooms) }), ...(params.squareFootage && { squareFootage: String(params.squareFootage) }) }).toString();
      return rentcastGet(`/avm/rent/long-term?${qs}`, creds.api_key);
    },
    get_avm: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const qs = new URLSearchParams({ address: params.address }).toString();
      return rentcastGet(`/avm/value?${qs}`, creds.api_key);
    },
    get_listings: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zipCode && { zipCode: params.zipCode }), limit: String(params.limit || 20), ...(params.propertyType && { propertyType: params.propertyType }) }).toString();
      return rentcastGet(`/listings/rental/long-term?${qs}`, creds.api_key);
    },
    get_market_statistics: async (params, creds) => {
      if (!params.zipCode) throw new Error('zipCode required');
      return rentcastGet(`/markets?zipCode=${params.zipCode}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
