/**
 * Yotpo Reviews & Loyalty API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getYotpoToken(creds) {
  return _cache.get(`yotpo:${creds.app_key}`, async () => {
    const body = JSON.stringify({ secret: creds.secret_key, grant_type: 'client_credentials' });
    const opts = { method: 'POST', hostname: 'api.yotpo.com', path: '/oauth/token', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    if (!r.access_token) throw new Error('Failed to get Yotpo token');
    return { token: r.access_token, expiresAt: Date.now() + (r.expires_in - 60) * 1000 };
  });
}

async function yotpoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.yotpo.com', path, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

async function yotpoAuthReq(method, path, body, creds) {
  const token = await getYotpoToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.yotpo.com', path, headers: { 'X-Yotpo-Token': token, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'yotpo',
  name: 'Yotpo',
  category: 'marketing',
  icon: 'Star',
  description: 'Manage product reviews, ratings, and loyalty programs with Yotpo.',
  configFields: [
    { key: 'app_key', label: 'App Key', type: 'string', required: true },
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_key || !creds.secret_key) throw new Error('app_key and secret_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      await getYotpoToken(creds);
      return { success: true, message: 'Connected to Yotpo' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_bottom_line: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return yotpoReq('GET', `/products/${creds.app_key}/yotpo_site_reviews/bottomline`, null, creds);
    },
    list_reviews: async (params, creds) => yotpoReq('GET', `/v1/apps/${creds.app_key}/reviews?count=${params.count || 20}&page=${params.page || 1}${params.product_id ? `&product_id=${params.product_id}` : ''}`, null, creds),
    list_products: async (params, creds) => yotpoAuthReq('GET', `/v1/apps/${creds.app_key}/products?count=${params.count || 20}&page=${params.page || 1}`, null, creds),
    get_product_reviews: async (params, creds) => {
      if (!params.product_id) throw new Error('product_id required');
      return yotpoReq('GET', `/v1/widget/${creds.app_key}/products/${params.product_id}/reviews.json?count=${params.count || 20}&page=${params.page || 1}`, null, creds);
    },
    list_ugc_photos: async (params, creds) => yotpoAuthReq('GET', `/v1/apps/${creds.app_key}/images/yotpo_images?count=${params.count || 20}&page=${params.page || 1}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
