/**
 * Woodpecker.co Cold Email Outreach API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function wpReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method, hostname: 'api.woodpecker.co', path: `/rest/v1${path}${sep}api_key=${creds.api_key}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'woodpecker',
  name: 'Woodpecker',
  category: 'marketing',
  icon: 'Mail',
  description: 'Manage cold email campaigns and prospects in Woodpecker.co.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wpReq('GET', '/campaign_list', null, creds); return { success: true, message: `${(r || []).length} campaign(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_campaigns: async (params, creds) => wpReq('GET', '/campaign_list', null, creds),
    get_campaign_stats: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return wpReq('GET', `/campaign_list?id=${params.campaign_id}`, null, creds);
    },
    list_prospects: async (params, creds) => wpReq('GET', `/prospect_list?page=${params.page || 1}&status=${params.status || 'ACTIVE'}`, null, creds),
    add_prospects: async (params, creds) => {
      if (!params.prospects || !Array.isArray(params.prospects)) throw new Error('prospects array required');
      return wpReq('POST', '/prospect', params.prospects, creds);
    },
    get_prospect: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return wpReq('GET', `/prospect_list?email=${encodeURIComponent(params.email)}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
