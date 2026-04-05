/**
 * Uber Direct (On-Demand Delivery) API Integration
 */
'use strict';
const https = require('https');
const { TokenCache, makeRequest } = require('../../engine/integration-utils');
const _tokenCache = new TokenCache();

function uberPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      method: 'POST', hostname: 'api.uber.com', path,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function uberGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.uber.com', path, headers: { 'Authorization': `Bearer ${token}` } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    req.end();
  });
}

async function getToken(clientId, clientSecret) {
  const cacheKey = clientId;
  const cached = _tokenCache.get(cacheKey);
  if (cached) return cached;
  return new Promise((resolve, reject) => {
    const body = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials&scope=eats.deliveries`;
    const opts = { method: 'POST', hostname: 'auth.uber.com', path: '/oauth/v2/token', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { const r = JSON.parse(d); if (r.access_token) { _tokenCache.set(cacheKey, r.access_token, r.expires_in || 2592000); resolve(r.access_token); } else reject(new Error(r.error_description || 'Token fetch failed')); } catch { reject(new Error('Token parse error')); } }); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'uber-direct',
  name: 'Uber Direct',
  category: 'food',
  icon: 'Truck',
  description: 'Create and track on-demand courier deliveries using Uber Direct API.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    { key: 'customer_id', label: 'Customer ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret || !creds.customer_id) throw new Error('client_id, client_secret, and customer_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds.client_id, creds.client_secret); return { success: true, message: 'Connected to Uber Direct' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_quote: async (params, creds) => {
      if (!params.pickup_address || !params.dropoff_address) throw new Error('pickup_address and dropoff_address required');
      const token = await getToken(creds.client_id, creds.client_secret);
      return uberPost(`/v1/customers/${creds.customer_id}/delivery_quotes`, params, token);
    },
    create_delivery: async (params, creds) => {
      if (!params.pickup || !params.dropoff) throw new Error('pickup and dropoff required');
      const token = await getToken(creds.client_id, creds.client_secret);
      return uberPost(`/v1/customers/${creds.customer_id}/deliveries`, params, token);
    },
    get_delivery: async (params, creds) => {
      if (!params.delivery_id) throw new Error('delivery_id required');
      const token = await getToken(creds.client_id, creds.client_secret);
      return uberGet(`/v1/customers/${creds.customer_id}/deliveries/${params.delivery_id}`, token);
    },
    cancel_delivery: async (params, creds) => {
      if (!params.delivery_id) throw new Error('delivery_id required');
      const token = await getToken(creds.client_id, creds.client_secret);
      return uberPost(`/v1/customers/${creds.customer_id}/deliveries/${params.delivery_id}/cancel`, {}, token);
    },
    list_deliveries: async (params, creds) => {
      const token = await getToken(creds.client_id, creds.client_secret);
      const qs = params.filter ? `?filter=${params.filter}` : '';
      return uberGet(`/v1/customers/${creds.customer_id}/deliveries${qs}`, token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
