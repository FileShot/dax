/**
 * Shopify Admin API Integration
 */
'use strict';
const https = require('https');

function shopifyApi(method, store, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `${store}.myshopify.com`, path: `/admin/api/2024-01${path}`, headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } };
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
  id: 'shopify',
  name: 'Shopify',
  category: 'commerce',
  icon: 'ShoppingBag',
  description: 'Manage Shopify products, orders, and customers.',
  configFields: [
    { key: 'store', label: 'Store Name (e.g. my-store)', type: 'text', required: true },
    { key: 'access_token', label: 'Admin API Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.store || !creds.access_token) throw new Error('Store name and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await shopifyApi('GET', creds.store, '/shop.json', creds.access_token); return { success: !!r.shop?.id, message: r.shop?.id ? `Connected to ${r.shop.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      const limit = params.limit || 20;
      return shopifyApi('GET', creds.store, `/products.json?limit=${limit}`, creds.access_token);
    },
    get_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return shopifyApi('GET', creds.store, `/products/${params.product_id}.json`, creds.access_token);
    },
    list_orders: async (params, creds) => {
      const limit = params.limit || 20;
      const status = params.status || 'any';
      return shopifyApi('GET', creds.store, `/orders.json?limit=${limit}&status=${status}`, creds.access_token);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      return shopifyApi('GET', creds.store, `/orders/${params.order_id}.json`, creds.access_token);
    },
    list_customers: async (params, creds) => {
      const limit = params.limit || 20;
      return shopifyApi('GET', creds.store, `/customers.json?limit=${limit}`, creds.access_token);
    },
    create_product: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      const product = { title: params.title };
      if (params.body_html) product.body_html = params.body_html;
      if (params.vendor) product.vendor = params.vendor;
      if (params.product_type) product.product_type = params.product_type;
      if (params.tags) product.tags = params.tags;
      if (params.variants) product.variants = params.variants;
      return shopifyApi('POST', creds.store, '/products.json', creds.access_token, { product });
    },
    update_inventory: async (params, creds) => {
      if (!params.inventory_item_id || params.available === undefined) throw new Error('inventory_item_id and available required');
      return shopifyApi('POST', creds.store, '/inventory_levels/set.json', creds.access_token, { inventory_item_id: params.inventory_item_id, location_id: params.location_id, available: params.available });
    },

    update_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      const product = {};
      if (params.title) product.title = params.title;
      if (params.body_html) product.body_html = params.body_html;
      if (params.status) product.status = params.status;
      if (params.tags) product.tags = params.tags;
      return shopifyApi('PUT', creds.store, `/products/${params.product_id}.json`, creds.access_token, { product });
    },

    search_customers: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const limit = params.limit || 20;
      return shopifyApi('GET', creds.store, `/customers/search.json?query=${encodeURIComponent(params.query)}&limit=${limit}`, creds.access_token);
    },

    create_customer: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      const customer = { email: params.email };
      if (params.first_name) customer.first_name = params.first_name;
      if (params.last_name) customer.last_name = params.last_name;
      if (params.phone) customer.phone = params.phone;
      if (params.tags) customer.tags = params.tags;
      return shopifyApi('POST', creds.store, '/customers.json', creds.access_token, { customer });
    },

    list_collections: async (params, creds) => {
      const limit = params.limit || 20;
      return shopifyApi('GET', creds.store, `/custom_collections.json?limit=${limit}`, creds.access_token);
    },

    fulfill_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      const fulfillment = { notify_customer: params.notify !== false };
      if (params.tracking_number) fulfillment.tracking_number = params.tracking_number;
      if (params.tracking_company) fulfillment.tracking_company = params.tracking_company;
      return shopifyApi('POST', creds.store, `/orders/${params.order_id}/fulfillments.json`, creds.access_token, { fulfillment });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
