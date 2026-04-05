/**
 * Iterable Cross-Channel Marketing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function itReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.iterable.com', path: `/api${path}`, headers: { 'Api-Key': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'iterable',
  name: 'Iterable',
  category: 'marketing',
  icon: 'Repeat',
  description: 'Manage Iterable cross-channel campaigns, users, events, and lists.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await itReq('GET', '/lists', null, creds); return { success: true, message: `Iterable: ${(r.lists || []).length} lists` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return itReq('GET', `/users/${encodeURIComponent(params.email)}`, null, creds);
    },
    update_user: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return itReq('POST', '/users/update', { email: params.email, dataFields: params.data_fields || {}, mergeNestedObjects: params.merge_nested || true }, creds);
    },
    track_event: async (params, creds) => {
      if (!params.email || !params.event_name) throw new Error('email and event_name required');
      return itReq('POST', '/events/track', { email: params.email, eventName: params.event_name, dataFields: params.data_fields || {}, createdAt: params.created_at || Date.now() }, creds);
    },
    list_campaigns: async (params, creds) => itReq('GET', '/campaigns', null, creds),
    list_lists: async (params, creds) => itReq('GET', '/lists', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
