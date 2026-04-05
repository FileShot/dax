/**
 * Eversign eSignature Integration
 */
'use strict';
const https = require('https');

function eversignGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.eversign.com', path: `/api${path}${path.includes('?') ? '&' : '?'}access_key=${apiKey}`, headers: { 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function eversignPost(path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = { method: 'POST', hostname: 'api.eversign.com', path: `/api${path}?access_key=${apiKey}`, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'eversign',
  name: 'Eversign',
  category: 'legal',
  icon: 'PenTool',
  description: 'Create and manage eSignature documents and templates via Eversign API.',
  configFields: [
    { key: 'api_key', label: 'Access Key', type: 'password', required: true },
    { key: 'business_id', label: 'Business ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.business_id) throw new Error('Access key and business ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await eversignGet(`/business?business_id=${creds.business_id}`, creds.api_key); if (r.success !== undefined && !r.success) return { success: false, message: r.error?.type || 'Auth failed' }; return { success: true, message: `Connected — business: ${r.name || creds.business_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_documents: async (params, creds) => {
      const qs = new URLSearchParams({ business_id: creds.business_id, type: params.type || 'all', ...(params.page && { page: String(params.page) }) }).toString();
      return eversignGet(`/document?${qs}`, creds.api_key);
    },
    get_document: async (params, creds) => {
      if (!params.document_hash) throw new Error('document_hash required');
      return eversignGet(`/document?business_id=${creds.business_id}&document_hash=${params.document_hash}`, creds.api_key);
    },
    create_document: async (params, creds) => {
      if (!params.title || !params.signers || !params.files) throw new Error('title, signers, and files required');
      return eversignPost(`/document?business_id=${creds.business_id}`, creds.api_key, { title: params.title, message: params.message || '', signers: params.signers, files: params.files, reminders: params.reminders ? 1 : 0 });
    },
    list_templates: async (_p, creds) => {
      return eversignGet(`/document_template?business_id=${creds.business_id}`, creds.api_key);
    },
    get_template: async (params, creds) => {
      if (!params.template_id) throw new Error('template_id required');
      return eversignGet(`/document_template?business_id=${creds.business_id}&template_id=${params.template_id}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
