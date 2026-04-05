/**
 * Klaviyo Email & SMS Marketing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function klReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'a.klaviyo.com', path, headers: { 'Authorization': `Klaviyo-API-Key ${creds.api_key}`, 'revision': '2024-02-15', 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'klaviyo',
  name: 'Klaviyo',
  category: 'marketing',
  icon: 'Mail',
  description: 'Manage Klaviyo email/SMS campaigns, lists, profiles, and metrics.',
  configFields: [{ key: 'api_key', label: 'Private API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await klReq('GET', '/api/accounts/', null, creds); return { success: true, message: `Connected to Klaviyo account` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_lists: async (params, creds) => klReq('GET', `/api/lists/?page[size]=${params.page_size || 20}`, null, creds),
    create_profile: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return klReq('POST', '/api/profiles/', { data: { type: 'profile', attributes: { email: params.email, ...params.properties } } }, creds);
    },
    get_profile: async (params, creds) => {
      if (!params.profile_id) throw new Error('profile_id required');
      return klReq('GET', `/api/profiles/${params.profile_id}/`, null, creds);
    },
    get_metrics: async (params, creds) => klReq('GET', `/api/metrics/?page[size]=${params.page_size || 20}`, null, creds),
    get_campaigns: async (params, creds) => {
      const channel = params.channel || 'email';
      return klReq('GET', `/api/campaigns/?filter=equals(messages.channel,'${channel}')&page[size]=${params.page_size || 20}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
