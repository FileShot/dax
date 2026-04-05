/**
 * Pipedrive CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function pdReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method, hostname: 'api.pipedrive.com', path: `/v1${path}${sep}api_token=${creds.api_token}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'pipedrive',
  name: 'Pipedrive',
  category: 'crm',
  icon: 'FunnelChart',
  description: 'Manage Pipedrive CRM deals, contacts, activities, and pipelines.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pdReq('GET', '/users/me', null, creds); return { success: true, message: `Connected as ${r.data?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_deals: async (params, creds) => pdReq('GET', `/deals?status=${params.status || 'open'}&limit=${params.limit || 20}`, null, creds),
    create_deal: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return pdReq('POST', '/deals', params, creds);
    },
    get_deal: async (params, creds) => {
      if (!params.id) throw new Error('deal id required');
      return pdReq('GET', `/deals/${params.id}`, null, creds);
    },
    search_persons: async (params, creds) => {
      if (!params.term) throw new Error('search term required');
      return pdReq('GET', `/persons/search?term=${encodeURIComponent(params.term)}&limit=${params.limit || 10}`, null, creds);
    },
    list_activities: async (params, creds) => pdReq('GET', `/activities?type=${params.type || ''}&limit=${params.limit || 20}&done=${params.done || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
