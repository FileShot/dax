/**
 * Coinbase Commerce Crypto Payments Integration
 */
'use strict';
const https = require('https');

function commerceRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.commerce.coinbase.com', path, headers: { 'X-CC-Api-Key': apiKey, 'X-CC-Version': '2018-03-22', 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'coinbase-commerce',
  name: 'Coinbase Commerce',
  category: 'blockchain',
  icon: 'Bitcoin',
  description: 'Accept cryptocurrency payments and manage charges with Coinbase Commerce.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await commerceRequest('GET', '/charges?limit=1', null, creds.api_key); return { success: !!r.data, message: r.error?.message || 'Connected to Coinbase Commerce' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_charge: async (params, creds) => {
      if (!params.name || !params.amount || !params.currency) throw new Error('name, amount, and currency required');
      const body = { name: params.name, description: params.description || '', local_price: { amount: String(params.amount), currency: params.currency }, pricing_type: params.pricing_type || 'fixed_price', ...(params.metadata && { metadata: params.metadata }), ...(params.redirect_url && { redirect_url: params.redirect_url }), ...(params.cancel_url && { cancel_url: params.cancel_url }) };
      return commerceRequest('POST', '/charges', body, creds.api_key);
    },
    get_charge: async (params, creds) => {
      if (!params.charge_code) throw new Error('charge_code required');
      return commerceRequest('GET', `/charges/${params.charge_code}`, null, creds.api_key);
    },
    list_charges: async (params, creds) => {
      const qs = `?limit=${params.limit || 25}${params.starting_after ? `&starting_after=${params.starting_after}` : ''}`;
      return commerceRequest('GET', `/charges${qs}`, null, creds.api_key);
    },
    create_checkout: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const body = { name: params.name, description: params.description || '', pricing_type: params.pricing_type || 'no_price', ...(params.local_price && { local_price: params.local_price }), ...(params.requested_info && { requested_info: params.requested_info }) };
      return commerceRequest('POST', '/checkouts', body, creds.api_key);
    },
    list_events: async (params, creds) => {
      const qs = `?limit=${params.limit || 25}${params.starting_after ? `&starting_after=${params.starting_after}` : ''}`;
      return commerceRequest('GET', `/events${qs}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
