/**
 * Gumroad Digital Products API Integration
 */
'use strict';
const https = require('https');

function gumroadRequest(method, path, body, accessToken) {
  return new Promise((resolve, reject) => {
    const baseQs = `access_token=${encodeURIComponent(accessToken)}`;
    const bodyStr = body ? new URLSearchParams(body).toString() : null;
    const opts = { method, hostname: 'api.gumroad.com', path: `/v2${path}${method === 'GET' ? `?${baseQs}` : ''}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(`${bodyStr}&${baseQs}`) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(`${bodyStr}&${baseQs}`);
    req.end();
  });
}

module.exports = {
  id: 'gumroad',
  name: 'Gumroad',
  category: 'ecommerce',
  icon: 'ShoppingCart',
  description: 'Manage digital products, sales, and subscribers on Gumroad.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gumroadRequest('GET', '/user', null, creds.access_token); return { success: r.success === true, message: r.message || `Connected — ${r.user?.name || 'user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_products: async (params, creds) => {
      return gumroadRequest('GET', '/products', null, creds.access_token);
    },
    get_product: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return gumroadRequest('GET', `/products/${params.product_id}`, null, creds.access_token);
    },
    list_sales: async (params, creds) => {
      return gumroadRequest('GET', `/products/${params.product_id || '_'}/sales?access_token=${creds.access_token}`, null, creds.access_token);
    },
    list_subscribers: async (params, creds) => {
      if (!params.resource_subscription_id) throw new Error('resource_subscription_id required');
      return gumroadRequest('GET', `/resource_subscriptions/${params.resource_subscription_id}/subscribers`, null, creds.access_token);
    },
    get_user: async (params, creds) => {
      return gumroadRequest('GET', '/user', null, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
