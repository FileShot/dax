/**
 * Papertrail Log Management API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ptReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'papertrailapp.com', path: `/api/v1${path}`, headers: { 'X-Papertrail-Token': creds.api_token, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'papertrail',
  name: 'Papertrail',
  category: 'monitoring',
  icon: 'FileText',
  description: 'Search and tail live log streams, manage systems, and set alerts in Papertrail.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ptReq('GET', '/systems.json', null, creds); return { success: true, message: `${(r || []).length} system(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.q) throw new Error('search query q required');
      const since = params.min_time ? `&min_time=${params.min_time}` : '';
      return ptReq('GET', `/events/search.json?q=${encodeURIComponent(params.q)}&limit=${params.limit || 100}${since}`, null, creds);
    },
    list_systems: async (params, creds) => ptReq('GET', '/systems.json', null, creds),
    get_system: async (params, creds) => {
      if (!params.system_id) throw new Error('system_id required');
      return ptReq('GET', `/systems/${params.system_id}.json`, null, creds);
    },
    list_groups: async (params, creds) => ptReq('GET', '/groups.json', null, creds),
    list_saved_searches: async (params, creds) => ptReq('GET', '/searches.json', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
