/**
 * BigCommerce REST API Integration
 */
'use strict';
const https = require('https');

function bcApi(method, storeHash, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.bigcommerce.com', path: `/stores/${storeHash}/v3${path}`, headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'bigcommerce',
  name: 'BigCommerce',
  category: 'ecommerce',
  icon: 'Store',
  description: 'Manage products, orders, and customers on BigCommerce.',
  configFields: [
    { key: 'store_hash', label: 'Store Hash', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.store_hash || !creds.access_token) throw new Error('Store hash and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bcApi('GET', creds.store_hash, '/catalog/summary', creds.access_token); return { success: !!r.data, message: r.data ? 'Connected to BigCommerce' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => bcApi('GET', creds.store_hash, `/catalog/products?limit=${params.limit || 20}&page=${params.page || 1}`, creds.access_token),
    get_product: async (params, creds) => { if (!params.product_id) throw new Error('product_id required'); return bcApi('GET', creds.store_hash, `/catalog/products/${params.product_id}`, creds.access_token); },
    create_product: async (params, creds) => { if (!params.name || !params.price || !params.type) throw new Error('name, price, and type required'); return bcApi('POST', creds.store_hash, '/catalog/products', creds.access_token, { name: params.name, price: params.price, type: params.type, weight: params.weight || 0 }); },
    list_orders: async (params, creds) => bcApi('GET', creds.store_hash, `/orders?limit=${params.limit || 20}`, creds.access_token),
    get_order: async (params, creds) => { if (!params.order_id) throw new Error('order_id required'); return bcApi('GET', creds.store_hash, `/orders/${params.order_id}`, creds.access_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
