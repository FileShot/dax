/**
 * Shipday Delivery Management API Integration
 */
'use strict';
const https = require('https');

function shipdayReq(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: 'api.shipday.com', path,
      headers: { 'Authorization': apiKey, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'shipday',
  name: 'Shipday',
  category: 'food',
  icon: 'PackageCheck',
  description: 'Manage delivery orders, dispatch drivers, and track last-mile deliveries with Shipday.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await shipdayReq('GET', '/orders/active', null, creds.api_key); if (Array.isArray(r) || r.orderDetails !== undefined) return { success: true, message: 'Connected to Shipday' }; if (r.message) return { success: false, message: r.message }; return { success: true, message: 'Connected to Shipday' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_order: async (params, creds) => {
      if (!params.orderNumber || !params.customerName || !params.customerAddress) throw new Error('orderNumber, customerName, and customerAddress required');
      return shipdayReq('POST', '/order', params, creds.api_key);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      return shipdayReq('GET', `/orders/${params.order_id}`, null, creds.api_key);
    },
    dispatch_order: async (params, creds) => {
      if (!params.order_id || !params.carrier_id) throw new Error('order_id and carrier_id required');
      return shipdayReq('POST', `/orders/${params.order_id}/assign`, { carrierId: params.carrier_id }, creds.api_key);
    },
    list_deliveries: async (params, creds) => {
      const path = params.active ? '/orders/active' : '/orders';
      return shipdayReq('GET', path, null, creds.api_key);
    },
    get_driver: async (params, creds) => {
      if (!params.driver_id) throw new Error('driver_id required');
      return shipdayReq('GET', `/carriers/${params.driver_id}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
