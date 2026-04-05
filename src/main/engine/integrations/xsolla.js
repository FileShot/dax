/**
 * Xsolla Game Commerce API Integration
 */
'use strict';
const https = require('https');

function xsollaRequest(method, path, body, apiKey, merchantId) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${merchantId}:${apiKey}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.xsolla.com', path, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'xsolla',
  name: 'Xsolla',
  category: 'gaming',
  icon: 'Coins',
  description: 'Manage in-game items, orders, and payments with Xsolla game commerce platform.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'merchant_id', label: 'Merchant ID', type: 'text', required: true },
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.merchant_id || !creds.project_id) throw new Error('API key, merchant ID, and project ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await xsollaRequest('GET', `/v2/project/${creds.project_id}/items/virtual_items`, null, creds.api_key, creds.merchant_id); return { success: !!r.items, message: r.errorMessage || 'Connected to Xsolla' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_items: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}&offset=${params.offset || 0}`;
      return xsollaRequest('GET', `/v2/project/${creds.project_id}/items/virtual_items${qs}`, null, creds.api_key, creds.merchant_id);
    },
    get_item: async (params, creds) => {
      if (!params.item_sku) throw new Error('item_sku required');
      return xsollaRequest('GET', `/v2/project/${creds.project_id}/items/virtual_items/sku/${params.item_sku}`, null, creds.api_key, creds.merchant_id);
    },
    list_orders: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}&offset=${params.offset || 0}`;
      return xsollaRequest('GET', `/v2/project/${creds.project_id}/orders${qs}`, null, creds.api_key, creds.merchant_id);
    },
    get_order: async (params, creds) => {
      if (!params.order_id) throw new Error('order_id required');
      return xsollaRequest('GET', `/v2/project/${creds.project_id}/orders/${params.order_id}`, null, creds.api_key, creds.merchant_id);
    },
    list_virtual_currencies: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}&offset=${params.offset || 0}`;
      return xsollaRequest('GET', `/v2/project/${creds.project_id}/items/virtual_currency${qs}`, null, creds.api_key, creds.merchant_id);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
