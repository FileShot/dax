/**
 * Flotiq Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function flotiqReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.flotiq.com', path: `/api/v1${path}`, headers: { 'X-AUTH-TOKEN': creds.api_key, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'flotiq',
  name: 'Flotiq',
  category: 'cms',
  icon: 'Layers',
  description: 'Access and manage content types, objects, and media in Flotiq headless CMS.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await flotiqReq('GET', '/internal/contenttype?limit=1', null, creds); return { success: true, message: `Connected — ${r.total_count ?? 0} content type(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_content_types: async (params, creds) => flotiqReq('GET', `/internal/contenttype?limit=${params.limit || 20}&page=${params.page || 1}`, null, creds),
    get_content_type: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return flotiqReq('GET', `/internal/contenttype/${params.name}`, null, creds);
    },
    list_content: async (params, creds) => {
      if (!params.content_type_name) throw new Error('content_type_name required');
      return flotiqReq('GET', `/content/${params.content_type_name}?limit=${params.limit || 20}&page=${params.page || 1}`, null, creds);
    },
    get_content: async (params, creds) => {
      if (!params.content_type_name || !params.id) throw new Error('content_type_name and id required');
      return flotiqReq('GET', `/content/${params.content_type_name}/${params.id}`, null, creds);
    },
    create_content: async (params, creds) => {
      if (!params.content_type_name || !params.data) throw new Error('content_type_name and data required');
      return flotiqReq('POST', `/content/${params.content_type_name}`, params.data, creds);
    },
    list_media: async (params, creds) => flotiqReq('GET', `/content/_media?limit=${params.limit || 20}&page=${params.page || 1}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
