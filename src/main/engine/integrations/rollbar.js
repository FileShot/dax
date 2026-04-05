/**
 * Rollbar Error Tracking API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function rbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method, hostname: 'api.rollbar.com', path: `/api/1${path}${sep}access_token=${creds.access_token}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'rollbar',
  name: 'Rollbar',
  category: 'monitoring',
  icon: 'AlertTriangle',
  description: 'Track and manage errors in Rollbar — items, occurrences, deploys, and people.',
  configFields: [{ key: 'access_token', label: 'Account or Project Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rbReq('GET', '/projects', null, creds); return { success: true, message: `Found ${(r.result || []).length} project(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_items: async (params, creds) => rbReq('GET', `/items/?status=${params.status || 'active'}&level=${params.level || 'error'}&page=${params.page || 1}`, null, creds),
    get_item: async (params, creds) => {
      if (!params.id) throw new Error('item id required');
      return rbReq('GET', `/item/${params.id}/`, null, creds);
    },
    list_occurrences: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return rbReq('GET', `/item/${params.item_id}/occurrences/?page=${params.page || 1}`, null, creds);
    },
    deploy: async (params, creds) => {
      if (!params.environment || !params.revision) throw new Error('environment and revision required');
      return rbReq('POST', '/deploy/', { environment: params.environment, revision: params.revision, local_username: params.local_username, comment: params.comment }, creds);
    },
    list_deploys: async (params, creds) => rbReq('GET', '/deploys/?page=1', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
