/**
 * DoorDash Drive Delivery API Integration
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function buildJwt(developerId, keyId, signingSecret) {
  // RS256 JWT using DoorDash credentials
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', 'dd-ver': 'DD-JWT-V1' })).toString('base64url');
  // Note: DoorDash uses HS256 with base64 decoded secret
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ aud: 'doordash', iss: developerId, kid: keyId, exp: now + 300, iat: now })).toString('base64url');
  const sigInput = `${header}.${payload}`;
  const secretBytes = Buffer.from(signingSecret, 'base64');
  const sig = crypto.createHmac('sha256', secretBytes).update(sigInput).digest('base64url');
  return `${sigInput}.${sig}`;
}

function ddReq(method, path, body, creds) {
  return new Promise((resolve, reject) => {
    const token = buildJwt(creds.developer_id, creds.key_id, creds.signing_secret);
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: 'openapi.doordash.com', path: `/drive/v2${path}`,
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'doordash',
  name: 'DoorDash Drive',
  category: 'food',
  icon: 'Bike',
  description: 'Create and manage on-demand delivery orders via DoorDash Drive API.',
  configFields: [
    { key: 'developer_id', label: 'Developer ID', type: 'text', required: true },
    { key: 'key_id', label: 'Key ID', type: 'text', required: true },
    { key: 'signing_secret', label: 'Signing Secret (base64)', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.developer_id || !creds.key_id || !creds.signing_secret) throw new Error('developer_id, key_id, and signing_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ddReq('GET', '/businesses', null, creds); if (r.code && r.code !== 200) return { success: false, message: r.message || 'Authentication failed' }; return { success: true, message: 'Connected to DoorDash Drive' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_delivery: async (params, creds) => {
      if (!params.external_delivery_id) throw new Error('external_delivery_id required');
      return ddReq('POST', '/deliveries', params, creds);
    },
    get_delivery: async (params, creds) => {
      if (!params.external_delivery_id) throw new Error('external_delivery_id required');
      return ddReq('GET', `/deliveries/${params.external_delivery_id}`, null, creds);
    },
    update_delivery: async (params, creds) => {
      if (!params.external_delivery_id) throw new Error('external_delivery_id required');
      const { external_delivery_id, ...body } = params;
      return ddReq('PATCH', `/deliveries/${external_delivery_id}`, body, creds);
    },
    cancel_delivery: async (params, creds) => {
      if (!params.external_delivery_id) throw new Error('external_delivery_id required');
      return ddReq('PUT', `/deliveries/${params.external_delivery_id}/cancel`, {}, creds);
    },
    get_business: async (params, creds) => {
      if (!params.external_business_id) throw new Error('external_business_id required');
      return ddReq('GET', `/businesses/${params.external_business_id}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
