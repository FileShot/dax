/**
 * Sanity.io CMS Integration
 */
'use strict';
const https = require('https');

function sanityApi(method, projectId, dataset, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `${projectId}.api.sanity.io`, path: `/v2021-10-21/data${path}/${dataset}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'sanity',
  name: 'Sanity',
  category: 'cms',
  icon: 'Layers',
  description: 'Manage structured content in Sanity.io.',
  configFields: [
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
    { key: 'dataset', label: 'Dataset', type: 'text', required: true, placeholder: 'production' },
    { key: 'token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.project_id || !creds.dataset || !creds.token) throw new Error('Project ID, dataset, and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sanityApi('GET', creds.project_id, creds.dataset, '/query?query=*[0]', creds.token); return { success: !!r.result, message: 'Connected to Sanity' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query: async (params, creds) => {
      if (!params.groq) throw new Error('groq query required');
      return sanityApi('GET', creds.project_id, creds.dataset, `/query?query=${encodeURIComponent(params.groq)}`, creds.token);
    },
    create_document: async (params, creds) => {
      if (!params.document) throw new Error('document object required');
      return sanityApi('POST', creds.project_id, creds.dataset, '/mutate', creds.token, { mutations: [{ create: params.document }] });
    },
    update_document: async (params, creds) => {
      if (!params.document_id || !params.set) throw new Error('document_id and set required');
      return sanityApi('POST', creds.project_id, creds.dataset, '/mutate', creds.token, { mutations: [{ patch: { id: params.document_id, set: params.set } }] });
    },
    delete_document: async (params, creds) => {
      if (!params.document_id) throw new Error('document_id required');
      return sanityApi('POST', creds.project_id, creds.dataset, '/mutate', creds.token, { mutations: [{ delete: { id: params.document_id } }] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
