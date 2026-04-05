/**
 * Lever Recruiting API Integration
 */
'use strict';
const https = require('https');

function leverRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.lever.co', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'lever',
  name: 'Lever',
  category: 'hr',
  icon: 'ClipboardList',
  description: 'Manage candidates, postings, and pipeline stages with Lever recruiting.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await leverRequest('GET', '/postings?limit=1', null, creds.api_key); return { success: !!r.data, message: r.code ? r.message : 'Connected to Lever' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_postings: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.state && { state: params.state }), ...(params.offset && { offset: params.offset }) }).toString();
      return leverRequest('GET', `/postings?${qs}`, null, creds.api_key);
    },
    get_posting: async (params, creds) => {
      if (!params.posting_id) throw new Error('posting_id required');
      return leverRequest('GET', `/postings/${params.posting_id}`, null, creds.api_key);
    },
    list_candidates: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}`;
      return leverRequest('GET', `/opportunities${qs}`, null, creds.api_key);
    },
    get_candidate: async (params, creds) => {
      if (!params.opportunity_id) throw new Error('opportunity_id required');
      return leverRequest('GET', `/opportunities/${params.opportunity_id}`, null, creds.api_key);
    },
    list_stages: async (params, creds) => {
      return leverRequest('GET', `/stages`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
