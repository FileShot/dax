/**
 * Contractbook Contract Management Integration
 */
'use strict';
const https = require('https');

function cbReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'api.contractbook.com', path: `/v1${path}`, headers: { 'Authorization': `${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'contractbook',
  name: 'Contractbook',
  category: 'legal',
  icon: 'FileSignature',
  description: 'Create and manage smart contracts and drafts via Contractbook API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cbReq('GET', '/drafts', creds.api_key); if (r.error) return { success: false, message: r.error.message || 'Auth failed' }; return { success: true, message: 'Connected to Contractbook' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contracts: async (params, creds) => {
      const qs = new URLSearchParams({ size: String(params.size || 20), ...(params.cursor && { cursor: params.cursor }) }).toString();
      return cbReq('GET', `/contracts?${qs}`, creds.api_key);
    },
    get_contract: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return cbReq('GET', `/contracts/${params.id}`, creds.api_key);
    },
    list_drafts: async (params, creds) => {
      const qs = new URLSearchParams({ size: String(params.size || 20) }).toString();
      return cbReq('GET', `/drafts?${qs}`, creds.api_key);
    },
    get_draft: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return cbReq('GET', `/drafts/${params.id}`, creds.api_key);
    },
    get_organization: async (_p, creds) => {
      return cbReq('GET', '/organization', creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
