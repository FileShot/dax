/**
 * Square API Integration
 */
'use strict';
const https = require('https');

function squareApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'connect.squareup.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' } };
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
  id: 'square',
  name: 'Square',
  category: 'ecommerce',
  icon: 'Square',
  description: 'Manage payments, catalog, and orders via Square API.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await squareApi('GET', '/locations', creds.access_token); return { success: !!r.locations, message: r.locations ? `${r.locations.length} location(s) found` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_locations: async (params, creds) => squareApi('GET', '/locations', creds.access_token),
    list_catalog: async (params, creds) => squareApi('GET', `/catalog/list?types=${params.types || 'ITEM'}`, creds.access_token),
    get_catalog_object: async (params, creds) => { if (!params.object_id) throw new Error('object_id required'); return squareApi('GET', `/catalog/object/${params.object_id}`, creds.access_token); },
    list_payments: async (params, creds) => squareApi('GET', `/payments?limit=${params.limit || 20}`, creds.access_token),
    list_orders: async (params, creds) => {
      if (!params.location_id) throw new Error('location_id required');
      return squareApi('POST', '/orders/search', creds.access_token, { location_ids: [params.location_id], limit: params.limit || 20 });
    },
    list_customers: async (params, creds) => squareApi('GET', `/customers?limit=${params.limit || 20}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
