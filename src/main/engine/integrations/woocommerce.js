/**
 * WooCommerce REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function wooApi(method, baseUrl, path, creds, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const auth = Buffer.from(`${creds.consumer_key}:${creds.consumer_secret}`).toString('base64');
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `${url.pathname.replace(/\/$/, '')}/wp-json/wc/v3${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'woocommerce',
  name: 'WooCommerce',
  category: 'ecommerce',
  icon: 'ShoppingCart',
  description: 'Manage products, orders, and customers in WooCommerce.',
  configFields: [
    { key: 'store_url', label: 'Store URL', type: 'text', required: true },
    { key: 'consumer_key', label: 'Consumer Key', type: 'password', required: true },
    { key: 'consumer_secret', label: 'Consumer Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.store_url || !creds.consumer_key || !creds.consumer_secret) throw new Error('Store URL, consumer key, and consumer secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wooApi('GET', creds.store_url, '/system_status', creds); return { success: !!r.environment, message: r.environment ? 'Connected to WooCommerce' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => wooApi('GET', creds.store_url, `/products?per_page=${params.limit || 20}&page=${params.page || 1}`, creds),
    get_product: async (params, creds) => { if (!params.product_id) throw new Error('product_id required'); return wooApi('GET', creds.store_url, `/products/${params.product_id}`, creds); },
    create_product: async (params, creds) => { if (!params.name) throw new Error('name required'); return wooApi('POST', creds.store_url, '/products', creds, { name: params.name, regular_price: params.price || '0', description: params.description || '', type: params.type || 'simple' }); },
    list_orders: async (params, creds) => wooApi('GET', creds.store_url, `/orders?per_page=${params.limit || 20}&status=${params.status || 'any'}`, creds),
    get_order: async (params, creds) => { if (!params.order_id) throw new Error('order_id required'); return wooApi('GET', creds.store_url, `/orders/${params.order_id}`, creds); },
    list_customers: async (params, creds) => wooApi('GET', creds.store_url, `/customers?per_page=${params.limit || 20}`, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
