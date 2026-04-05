/**
 * Magento / Adobe Commerce REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function magentoApi(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `/rest/V1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = mod.request(opts, (res) => {
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
  id: 'magento',
  name: 'Magento',
  category: 'ecommerce',
  icon: 'ShoppingBag',
  description: 'Manage products, orders, and customers in Magento/Adobe Commerce.',
  configFields: [
    { key: 'store_url', label: 'Store URL', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.store_url || !creds.access_token) throw new Error('Store URL and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await magentoApi('GET', creds.store_url, '/store/storeConfigs', creds.access_token); return { success: Array.isArray(r), message: Array.isArray(r) ? 'Connected to Magento' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      const limit = params.limit || 20;
      const page = params.page || 1;
      return magentoApi('GET', creds.store_url, `/products?searchCriteria[pageSize]=${limit}&searchCriteria[currentPage]=${page}`, creds.access_token);
    },
    get_product: async (params, creds) => { if (!params.sku) throw new Error('sku required'); return magentoApi('GET', creds.store_url, `/products/${encodeURIComponent(params.sku)}`, creds.access_token); },
    list_orders: async (params, creds) => {
      const limit = params.limit || 20;
      return magentoApi('GET', creds.store_url, `/orders?searchCriteria[pageSize]=${limit}`, creds.access_token);
    },
    get_order: async (params, creds) => { if (!params.order_id) throw new Error('order_id required'); return magentoApi('GET', creds.store_url, `/orders/${params.order_id}`, creds.access_token); },
    list_customers: async (params, creds) => magentoApi('GET', creds.store_url, `/customers/search?searchCriteria[pageSize]=${params.limit || 20}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
