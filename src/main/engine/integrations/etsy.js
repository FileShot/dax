/**
 * Etsy Open API v3 Integration
 */
'use strict';
const https = require('https');

function etsyApi(method, path, apiKey, token, body = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, hostname: 'openapi.etsy.com', path: `/v3/application${path}`, headers };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'etsy',
  name: 'Etsy',
  category: 'ecommerce',
  icon: 'Gift',
  description: 'Manage Etsy shop listings, orders, and reviews.',
  configFields: [
    { key: 'api_key', label: 'API Key (Keystring)', type: 'password', required: true },
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'shop_id', label: 'Shop ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.access_token || !creds.shop_id) throw new Error('API key, access token, and shop ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await etsyApi('GET', `/shops/${creds.shop_id}`, creds.api_key, creds.access_token); return { success: !!r.shop_id, message: r.shop_name ? `Connected to ${r.shop_name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_listings: async (params, creds) => etsyApi('GET', `/shops/${creds.shop_id}/listings?limit=${params.limit || 25}&state=${params.state || 'active'}`, creds.api_key, creds.access_token),
    get_listing: async (params, creds) => { if (!params.listing_id) throw new Error('listing_id required'); return etsyApi('GET', `/listings/${params.listing_id}`, creds.api_key, creds.access_token); },
    list_receipts: async (params, creds) => etsyApi('GET', `/shops/${creds.shop_id}/receipts?limit=${params.limit || 25}`, creds.api_key, creds.access_token),
    get_receipt: async (params, creds) => { if (!params.receipt_id) throw new Error('receipt_id required'); return etsyApi('GET', `/shops/${creds.shop_id}/receipts/${params.receipt_id}`, creds.api_key, creds.access_token); },
    list_reviews: async (params, creds) => etsyApi('GET', `/shops/${creds.shop_id}/reviews?limit=${params.limit || 25}`, creds.api_key, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
