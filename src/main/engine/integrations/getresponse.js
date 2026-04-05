/**
 * GetResponse Email Marketing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function grReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.getresponse.com', path: `/v3${path}`, headers: { 'X-Auth-Token': `api-key ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'getresponse',
  name: 'GetResponse',
  category: 'marketing',
  icon: 'Send',
  description: 'Manage GetResponse contacts, lists, campaigns, and landing pages.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await grReq('GET', '/accounts', null, creds); return { success: true, message: `Connected: ${r.login}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => grReq('GET', `/contacts?perPage=${params.per_page || 100}&page=${params.page || 1}${params.email ? `&query[email]=${encodeURIComponent(params.email)}` : ''}`, null, creds),
    add_contact: async (params, creds) => {
      if (!params.email || !params.campaign_id) throw new Error('email and campaign_id required');
      return grReq('POST', '/contacts', { email: params.email, name: params.name || '', campaign: { campaignId: params.campaign_id }, customFieldValues: params.custom_fields || [] }, creds);
    },
    list_campaigns: async (params, creds) => grReq('GET', `/campaigns?perPage=${params.per_page || 100}`, null, creds),
    get_campaign: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return grReq('GET', `/campaigns/${params.campaign_id}`, null, creds);
    },
    list_newsletters: async (params, creds) => grReq('GET', `/newsletters?perPage=${params.per_page || 20}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
