/**
 * Builder.io Visual Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function builderReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const authHeader = creds.private_key ? { 'Authorization': `Bearer ${creds.private_key}` } : {};
  const opts = { method, hostname: 'cdn.builder.io', path, headers: { ...authHeader, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

async function builderWriteReq(method, path, body, creds) {
  if (!creds.private_key) throw new Error('private_key required for write operations');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'builder.io', path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${creds.private_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'builder-io',
  name: 'Builder.io',
  category: 'cms',
  icon: 'Layout',
  description: 'Fetch and manage visual content, pages, and sections in Builder.io headless CMS.',
  configFields: [
    { key: 'public_key', label: 'Public API Key', type: 'string', required: true },
    { key: 'private_key', label: 'Private API Key', type: 'password', required: false, description: 'Required for write/admin operations' },
  ],
  async connect(creds) { if (!creds.public_key) throw new Error('public_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await builderReq('GET', `/api/v3/content/page?apiKey=${creds.public_key}&limit=1`, null, creds); return { success: true, message: `Connected — ${r.results?.length ?? 0} page(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_content: async (params, creds) => {
      if (!params.model) throw new Error('model required');
      return builderReq('GET', `/api/v3/content/${params.model}?apiKey=${creds.public_key}&limit=${params.limit || 20}&offset=${params.offset || 0}${params.url ? `&url=${encodeURIComponent(params.url)}` : ''}`, null, creds);
    },
    get_entry: async (params, creds) => {
      if (!params.model || !params.entry_id) throw new Error('model and entry_id required');
      return builderReq('GET', `/api/v3/content/${params.model}/${params.entry_id}?apiKey=${creds.public_key}`, null, creds);
    },
    list_content: async (params, creds) => {
      if (!params.model) throw new Error('model required');
      return builderReq('GET', `/api/v3/content/${params.model}?apiKey=${creds.public_key}&limit=${params.limit || 20}&offset=${params.offset || 0}&includeUnpublished=${params.include_drafts || false}`, null, creds);
    },
    list_models: async (params, creds) => builderWriteReq('GET', '/models', null, creds),
    publish_entry: async (params, creds) => {
      if (!params.model || !params.entry_id) throw new Error('model and entry_id required');
      return builderWriteReq('PUT', `/content/${params.model}/${params.entry_id}`, { published: 'published' }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
