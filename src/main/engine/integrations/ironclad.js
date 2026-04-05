/**
 * Ironclad Contract Lifecycle Management Integration
 */
'use strict';
const https = require('https');

function ironcladReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'ironcladapp.com', path: `/public/api/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'ironclad',
  name: 'Ironclad',
  category: 'legal',
  icon: 'Shield',
  description: 'Manage Ironclad contract workflows, documents, approvals, and records.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ironcladReq('GET', '/workflows/templates?limit=1', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to Ironclad' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_workflows: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.status && { status: params.status }), ...(params.cursor && { cursor: params.cursor }) }).toString();
      return ironcladReq('GET', `/workflows?${qs}`, creds.api_key);
    },
    get_workflow: async (params, creds) => {
      if (!params.workflow_id) throw new Error('workflow_id required');
      return ironcladReq('GET', `/workflows/${params.workflow_id}`, creds.api_key);
    },
    create_workflow: async (params, creds) => {
      if (!params.template_id || !params.attributes) throw new Error('template_id and attributes required');
      return ironcladReq('POST', '/workflows', creds.api_key, { template: { id: params.template_id }, attributes: params.attributes });
    },
    get_document: async (params, creds) => {
      if (!params.workflow_id) throw new Error('workflow_id required');
      return ironcladReq('GET', `/workflows/${params.workflow_id}/documents`, creds.api_key);
    },
    list_workflow_templates: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20) }).toString();
      return ironcladReq('GET', `/workflows/templates?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
