/**
 * Directus Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function directusReq(method, path, body, creds) {
  if (!creds.host) throw new Error('host required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: creds.host, path: `/items${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

async function directusApiReq(method, path, body, creds) {
  if (!creds.host) throw new Error('host required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: creds.host, path, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'directus',
  name: 'Directus',
  category: 'cms',
  icon: 'Database',
  description: 'Manage collections, items, files, and users via Directus headless CMS REST API.',
  configFields: [
    { key: 'host', label: 'Host', type: 'string', required: true, description: 'Your Directus instance hostname (e.g. myapp.directus.app)' },
    { key: 'api_token', label: 'Static API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.host || !creds.api_token) throw new Error('host and api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await directusApiReq('GET', '/server/health', null, creds); return { success: true, message: `Connected — status: ${r.status || 'ok'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_items: async (params, creds) => {
      if (!params.collection) throw new Error('collection required');
      return directusReq('GET', `/${params.collection}?limit=${params.limit || 25}&offset=${params.offset || 0}${params.filter ? `&filter=${encodeURIComponent(JSON.stringify(params.filter))}` : ''}`, null, creds);
    },
    get_item: async (params, creds) => {
      if (!params.collection || !params.id) throw new Error('collection and id required');
      return directusReq('GET', `/${params.collection}/${params.id}`, null, creds);
    },
    create_item: async (params, creds) => {
      if (!params.collection || !params.data) throw new Error('collection and data required');
      return directusReq('POST', `/${params.collection}`, params.data, creds);
    },
    update_item: async (params, creds) => {
      if (!params.collection || !params.id || !params.data) throw new Error('collection, id, and data required');
      return directusReq('PATCH', `/${params.collection}/${params.id}`, params.data, creds);
    },
    list_collections: async (params, creds) => directusApiReq('GET', '/collections', null, creds),
    list_files: async (params, creds) => directusApiReq('GET', `/files?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
