/**
 * Printful Print-on-Demand API Integration
 */
'use strict';
const https = require('https');

function printfulRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.printful.com', path, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'printful',
  name: 'Printful',
  category: 'ecommerce',
  icon: 'Printer',
  description: 'Manage print-on-demand products, orders, and fulfillment with Printful.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await printfulRequest('GET', '/store', null, creds.api_key); return { success: r.code === 200, message: r.error?.reason || `Connected — ${r.result?.name || 'store'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      const qs = params.offset ? `?offset=${params.offset}&limit=${params.limit || 20}` : `?limit=${params.limit || 20}`;
      return printfulRequest('GET', `/store/products${qs}`, null, creds.api_key);
    },
    get_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return printfulRequest('GET', `/store/products/${params.product_id}`, null, creds.api_key);
    },
    list_orders: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.status && { status: params.status }), ...(params.offset && { offset: String(params.offset) }) }).toString();
      return printfulRequest('GET', `/orders?${qs}`, null, creds.api_key);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      return printfulRequest('GET', `/orders/${params.order_id}`, null, creds.api_key);
    },
    list_catalog_products: async (params, creds) => {
      const qs = params.category_id ? `?category_id=${params.category_id}` : '';
      return printfulRequest('GET', `/products${qs}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
