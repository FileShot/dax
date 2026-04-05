/**
 * Cosmic Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function cosmicReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.cosmicjs.com', path: `/v3/buckets/${creds.bucket_slug}${path}`, headers: { 'Authorization': `Bearer ${creds.read_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'cosmicjs',
  name: 'Cosmic',
  category: 'cms',
  icon: 'Layers',
  description: 'Manage objects, media, and metadata in your Cosmic headless CMS bucket.',
  configFields: [
    { key: 'bucket_slug', label: 'Bucket Slug', type: 'string', required: true },
    { key: 'read_key', label: 'Read Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.bucket_slug || !creds.read_key) throw new Error('bucket_slug and read_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cosmicReq('GET', '/objects?limit=1', null, creds); return { success: true, message: `Connected — ${r.total ?? 0} object(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_objects: async (params, creds) => cosmicReq('GET', `/objects?limit=${params.limit || 20}&skip=${params.skip || 0}${params.type ? `&type=${params.type}` : ''}`, null, creds),
    get_object: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return cosmicReq('GET', `/objects/${params.id}`, null, creds);
    },
    search_objects: async (params, creds) => {
      if (!params.q) throw new Error('q (query) required');
      return cosmicReq('GET', `/objects?query=${encodeURIComponent(params.q)}&limit=${params.limit || 20}`, null, creds);
    },
    list_object_types: async (params, creds) => cosmicReq('GET', '/object-types', null, creds),
    list_media: async (params, creds) => cosmicReq('GET', `/media?limit=${params.limit || 20}&skip=${params.skip || 0}`, null, creds),
    get_bucket: async (params, creds) => cosmicReq('GET', '', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
