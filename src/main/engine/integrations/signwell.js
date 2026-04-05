/**
 * SignWell eSignature Integration
 */
'use strict';
const https = require('https');

function signwellReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'www.signwell.com', path: `/api/v1${path}`, headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'signwell',
  name: 'SignWell',
  category: 'legal',
  icon: 'Signature',
  description: 'Send documents for eSignature and manage signing workflows via SignWell API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await signwellReq('GET', '/me', creds.api_key); if (r.errors) return { success: false, message: r.errors[0] || 'Auth failed' }; return { success: true, message: `Connected as ${r.email || 'SignWell user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_documents: async (params, creds) => {
      const qs = new URLSearchParams({ page: String(params.page || 1), per_page: String(params.per_page || 20), ...(params.status && { status: params.status }) }).toString();
      return signwellReq('GET', `/documents?${qs}`, creds.api_key);
    },
    get_document: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return signwellReq('GET', `/documents/${params.id}`, creds.api_key);
    },
    create_document: async (params, creds) => {
      if (!params.name || !params.files || !params.recipients) throw new Error('name, files, and recipients required');
      return signwellReq('POST', '/documents', creds.api_key, { name: params.name, files: params.files, recipients: params.recipients, message: params.message || '', apply_signing_order: params.apply_signing_order || false });
    },
    list_templates: async (params, creds) => {
      const qs = new URLSearchParams({ page: String(params.page || 1), per_page: String(params.per_page || 20) }).toString();
      return signwellReq('GET', `/documents/templates?${qs}`, creds.api_key);
    },
    send_reminder: async (params, creds) => {
      if (!params.document_id) throw new Error('document_id required');
      return signwellReq('POST', `/documents/${params.document_id}/remind`, creds.api_key, {});
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
