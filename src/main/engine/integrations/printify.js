/**
 * Printify Print-on-Demand API Integration
 */
'use strict';
const https = require('https');

function printifyRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.printify.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'printify',
  name: 'Printify',
  category: 'ecommerce',
  icon: 'Printer',
  description: 'Manage print-on-demand products and orders with Printify.',
  configFields: [
    { key: 'api_key', label: 'Personal Access Token', type: 'password', required: true },
    { key: 'shop_id', label: 'Shop ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.shop_id) throw new Error('API key and shop ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await printifyRequest('GET', '/shops.json', null, creds.api_key); return { success: Array.isArray(r), message: Array.isArray(r) ? `Connected — ${r.length} shop(s)` : JSON.stringify(r) }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      const qs = `?limit=${params.limit || 10}&page=${params.page || 1}`;
      return printifyRequest('GET', `/shops/${creds.shop_id}/products.json${qs}`, null, creds.api_key);
    },
    get_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return printifyRequest('GET', `/shops/${creds.shop_id}/products/${params.product_id}.json`, null, creds.api_key);
    },
    list_orders: async (params, creds) => {
      const qs = `?limit=${params.limit || 10}&page=${params.page || 1}`;
      return printifyRequest('GET', `/shops/${creds.shop_id}/orders.json${qs}`, null, creds.api_key);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      return printifyRequest('GET', `/shops/${creds.shop_id}/orders/${params.order_id}.json`, null, creds.api_key);
    },
    list_blueprints: async (params, creds) => {
      return printifyRequest('GET', '/catalog/blueprints.json', null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
