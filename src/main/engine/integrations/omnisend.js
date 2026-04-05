/**
 * Omnisend Email Marketing & Automation API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function omniReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.omnisend.com', path: `/v3${path}`, headers: { 'X-API-KEY': creds.api_key, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'omnisend',
  name: 'Omnisend',
  category: 'marketing',
  icon: 'Mail',
  description: 'Manage contacts, campaigns, and automations for ecommerce with Omnisend.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await omniReq('GET', '/contacts?limit=1', null, creds); return { success: true, message: `Connected — ${r.paging?.total ?? 0} contact(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => omniReq('GET', `/contacts?limit=${params.limit || 25}&offset=${params.offset || 0}${params.status ? `&status=${params.status}` : ''}`, null, creds),
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return omniReq('POST', '/contacts', { identifiers: [{ type: 'email', id: params.email, channels: { email: { status: 'subscribed', statusDate: new Date().toISOString() } } }], firstName: params.first_name, lastName: params.last_name }, creds);
    },
    list_campaigns: async (params, creds) => omniReq('GET', `/campaigns?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    get_campaign_stats: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return omniReq('GET', `/campaigns/${params.campaign_id}/statistics`, null, creds);
    },
    list_automations: async (params, creds) => omniReq('GET', `/automations?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    list_segments: async (params, creds) => omniReq('GET', `/segments?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
