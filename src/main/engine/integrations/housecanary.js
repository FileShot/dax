/**
 * HouseCanary Automated Valuation Model (AVM) Integration
 */
'use strict';
const https = require('https');

function hcReq(method, path, apiKey, apiSecret, body) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'api.housecanary.com', path, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'housecanary',
  name: 'HouseCanary',
  category: 'realestate',
  icon: 'BarChart',
  description: 'Access HouseCanary property values, rental estimates, and block/zip level analytics.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'text', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.api_secret) throw new Error('API key and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hcReq('GET', '/v2/property/value?address=123 Main St&zipcode=10001', creds.api_key, creds.api_secret); if (r.status && r.status.code !== 0) return { success: false, message: r.status.message || 'Auth failed' }; return { success: true, message: 'Connected to HouseCanary' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_value: async (params, creds) => {
      if (!params.address || !params.zipcode) throw new Error('address and zipcode required');
      return hcReq('GET', `/v2/property/value?address=${encodeURIComponent(params.address)}&zipcode=${params.zipcode}`, creds.api_key, creds.api_secret);
    },
    get_rental_value: async (params, creds) => {
      if (!params.address || !params.zipcode) throw new Error('address and zipcode required');
      return hcReq('GET', `/v2/property/rental_value?address=${encodeURIComponent(params.address)}&zipcode=${params.zipcode}`, creds.api_key, creds.api_secret);
    },
    get_property_details: async (params, creds) => {
      if (!params.address || !params.zipcode) throw new Error('address and zipcode required');
      return hcReq('GET', `/v2/property/details?address=${encodeURIComponent(params.address)}&zipcode=${params.zipcode}`, creds.api_key, creds.api_secret);
    },
    get_block_statistics: async (params, creds) => {
      if (!params.address || !params.zipcode) throw new Error('address and zipcode required');
      return hcReq('GET', `/v2/block/value_distribution?address=${encodeURIComponent(params.address)}&zipcode=${params.zipcode}`, creds.api_key, creds.api_secret);
    },
    get_zip_statistics: async (params, creds) => {
      if (!params.zipcode) throw new Error('zipcode required');
      return hcReq('GET', `/v2/zip/value_distribution?zipcode=${params.zipcode}`, creds.api_key, creds.api_secret);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
