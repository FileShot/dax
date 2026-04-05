/**
 * Open States Legislative Data Integration (free with API key)
 */
'use strict';
const https = require('https');

function osReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'v3.openstates.org', path, headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'openstates',
  name: 'Open States',
  category: 'legal',
  icon: 'FileCheck',
  description: 'Access US state legislative data — bills, votes, legislators, and committees.',
  configFields: [{ key: 'api_key', label: 'API Key (free at openstates.org)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await osReq('GET', '/jurisdictions/?classification=government&include=legislative_sessions&page=1&per_page=1', creds.api_key); if (r.detail) return { success: false, message: r.detail }; return { success: true, message: 'Connected to Open States' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_bills: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.q && { q: params.q }), ...(params.jurisdiction && { jurisdiction: params.jurisdiction }), ...(params.session && { session: params.session }), ...(params.subject && { subject: params.subject }), per_page: String(params.per_page || 20), page: String(params.page || 1) }).toString();
      return osReq('GET', `/bills/?${qs}`, creds.api_key);
    },
    get_bill: async (params, creds) => {
      if (!params.id) throw new Error('id required (e.g. ocd-bill/...)');
      return osReq('GET', `/bills/${encodeURIComponent(params.id)}`, creds.api_key);
    },
    search_legislators: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.name && { name: params.name }), ...(params.jurisdiction && { jurisdiction: params.jurisdiction }), ...(params.party && { party: params.party }), per_page: String(params.per_page || 20), page: String(params.page || 1) }).toString();
      return osReq('GET', `/people/?${qs}`, creds.api_key);
    },
    get_legislator: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return osReq('GET', `/people/${encodeURIComponent(params.id)}`, creds.api_key);
    },
    list_jurisdictions: async (params, creds) => {
      const qs = new URLSearchParams({ classification: 'government', per_page: String(params.per_page || 60) }).toString();
      return osReq('GET', `/jurisdictions/?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
