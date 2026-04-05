/**
 * Prepr CMS Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function preprReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'cdn.prepr.io', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

async function preprMgmtReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.eu1.prepr.io', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'prepr-cms',
  name: 'Prepr CMS',
  category: 'cms',
  icon: 'Layers',
  description: 'Access publications, segments, and content from Prepr CMS headless platform.',
  configFields: [{ key: 'access_token', label: 'Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await preprReq('GET', '/?limit=1', null, creds); return { success: true, message: `Connected to Prepr CMS` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_publications: async (params, creds) => preprReq('GET', `/?limit=${params.limit || 20}&skip=${params.skip || 0}${params.model ? `&model=${params.model}` : ''}`, null, creds),
    get_publication: async (params, creds) => {
      if (!params.slug && !params.id) throw new Error('slug or id required');
      const query = params.id ? `id=${params.id}` : `slug=${params.slug}`;
      return preprReq('GET', `?${query}&limit=1`, null, creds);
    },
    list_content_models: async (params, creds) => preprMgmtReq('GET', '/models', null, creds),
    list_segments: async (params, creds) => preprMgmtReq('GET', `/segments?limit=${params.limit || 20}`, null, creds),
    list_tags: async (params, creds) => preprReq('GET', `/tags?limit=${params.limit || 50}`, null, creds),
    list_authors: async (params, creds) => preprReq('GET', `/persons?limit=${params.limit || 20}&skip=${params.skip || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
