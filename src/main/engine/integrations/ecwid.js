/**
 * Ecwid (Lightspeed) E-commerce API Integration
 */
'use strict';
const https = require('https');

function ecwidRequest(method, path, body, storeId, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method, hostname: 'app.ecwid.com', path: `/api/v3/${storeId}${path}${separator}token=${encodeURIComponent(token)}`, headers: { 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'ecwid',
  name: 'Ecwid',
  category: 'ecommerce',
  icon: 'Store',
  description: 'Manage products, orders, and customers in your Ecwid (Lightspeed) store.',
  configFields: [
    { key: 'store_id', label: 'Store ID', type: 'text', required: true },
    { key: 'secret_token', label: 'Secret Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.store_id || !creds.secret_token) throw new Error('Store ID and secret token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ecwidRequest('GET', '/profile', null, creds.store_id, creds.secret_token); return { success: !!r.generalInfo, message: r.errorMessage || `Connected — ${r.generalInfo?.storeUrl || 'store'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      const qs = `?offset=${params.offset || 0}&limit=${params.limit || 20}${params.keyword ? `&keyword=${encodeURIComponent(params.keyword)}` : ''}`;
      return ecwidRequest('GET', `/products${qs}`, null, creds.store_id, creds.secret_token);
    },
    get_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return ecwidRequest('GET', `/products/${params.product_id}`, null, creds.store_id, creds.secret_token);
    },
    list_orders: async (params, creds) => {
      const qs = `?offset=${params.offset || 0}&limit=${params.limit || 20}${params.payment_status ? `&paymentStatus=${encodeURIComponent(params.payment_status)}` : ''}`;
      return ecwidRequest('GET', `/orders${qs}`, null, creds.store_id, creds.secret_token);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      return ecwidRequest('GET', `/orders/${params.order_id}`, null, creds.store_id, creds.secret_token);
    },
    list_customers: async (params, creds) => {
      const qs = `?offset=${params.offset || 0}&limit=${params.limit || 20}`;
      return ecwidRequest('GET', `/customers${qs}`, null, creds.store_id, creds.secret_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
