/**
 * Contentstack Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function csReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const region = creds.region || 'us';
  const hostname = region === 'eu' ? 'eu-api.contentstack.com' : 'api.contentstack.io';
  const opts = { method, hostname, path: `/v3${path}`, headers: { 'api_key': creds.api_key, 'authorization': creds.management_token || creds.delivery_token, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'contentstack',
  name: 'Contentstack',
  category: 'cms',
  icon: 'Layers',
  description: 'Manage content types, entries, and assets in Contentstack headless CMS.',
  configFields: [
    { key: 'api_key', label: 'Stack API Key', type: 'string', required: true },
    { key: 'management_token', label: 'Management Token', type: 'password', required: true },
    { key: 'region', label: 'Region', type: 'string', required: false, description: 'us (default) or eu' },
  ],
  async connect(creds) { if (!creds.api_key || !creds.management_token) throw new Error('api_key and management_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await csReq('GET', '/content_types?count=true&limit=1', null, creds); return { success: true, message: `Connected — ${r.count ?? 0} content type(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_content_types: async (params, creds) => csReq('GET', `/content_types?limit=${params.limit || 20}&skip=${params.skip || 0}`, null, creds),
    get_entries: async (params, creds) => {
      if (!params.content_type_uid) throw new Error('content_type_uid required');
      return csReq('GET', `/content_types/${params.content_type_uid}/entries?limit=${params.limit || 20}&skip=${params.skip || 0}${params.locale ? `&locale=${params.locale}` : ''}`, null, creds);
    },
    get_entry: async (params, creds) => {
      if (!params.content_type_uid || !params.entry_uid) throw new Error('content_type_uid and entry_uid required');
      return csReq('GET', `/content_types/${params.content_type_uid}/entries/${params.entry_uid}`, null, creds);
    },
    publish_entry: async (params, creds) => {
      if (!params.content_type_uid || !params.entry_uid) throw new Error('content_type_uid and entry_uid required');
      return csReq('POST', `/content_types/${params.content_type_uid}/entries/${params.entry_uid}/publish`, { entry: { environments: params.environments || ['development'], locales: params.locales || ['en-us'] }, version: params.version || 1 }, creds);
    },
    list_assets: async (params, creds) => csReq('GET', `/assets?limit=${params.limit || 20}&skip=${params.skip || 0}`, null, creds),
    list_environments: async (params, creds) => csReq('GET', '/environments', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
