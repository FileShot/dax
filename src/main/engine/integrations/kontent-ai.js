/**
 * Kontent.ai Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function kontentReq(method, path, body, creds) {
  if (!creds.environment_id) throw new Error('environment_id required');
  const bodyStr = body ? JSON.stringify(body) : null;
  // Management API for write operations, Delivery API for read
  const useManagement = method !== 'GET' || params?._useManagement;
  const hostname = 'manage.kontent.ai';
  const opts = { method, hostname, path: `/v2/projects/${creds.environment_id}${path}`, headers: { 'Authorization': `Bearer ${creds.management_api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

async function kontentDeliveryReq(path, creds) {
  if (!creds.environment_id) throw new Error('environment_id required');
  const headers = { 'Accept': 'application/json' };
  if (creds.preview_api_key) headers['Authorization'] = `Bearer ${creds.preview_api_key}`;
  const hostname = creds.preview_api_key ? 'preview-deliver.kontent.ai' : 'deliver.kontent.ai';
  const opts = { method: 'GET', hostname, path: `/v2/${creds.environment_id}${path}`, headers };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'kontent-ai',
  name: 'Kontent.ai',
  category: 'cms',
  icon: 'Layers',
  description: 'Manage content items, types, and taxonomy in Kontent.ai headless CMS.',
  configFields: [
    { key: 'environment_id', label: 'Environment ID', type: 'string', required: true },
    { key: 'management_api_key', label: 'Management API Key', type: 'password', required: false },
    { key: 'preview_api_key', label: 'Preview API Key', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.environment_id) throw new Error('environment_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await kontentDeliveryReq('/items?limit=1', creds); return { success: true, message: `Connected — ${r.pagination?.total ?? 0} content item(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_items: async (params, creds) => kontentDeliveryReq(`/items?limit=${params.limit || 20}&skip=${params.skip || 0}${params.type ? `&system.type=${params.type}` : ''}`, creds),
    get_item: async (params, creds) => {
      if (!params.codename) throw new Error('codename required');
      return kontentDeliveryReq(`/items/${params.codename}`, creds);
    },
    list_content_types: async (params, creds) => kontentDeliveryReq('/types', creds),
    get_content_type: async (params, creds) => {
      if (!params.codename) throw new Error('codename required');
      return kontentDeliveryReq(`/types/${params.codename}`, creds);
    },
    list_taxonomies: async (params, creds) => kontentDeliveryReq('/taxonomies', creds),
    list_languages: async (params, creds) => kontentDeliveryReq('/languages', creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
