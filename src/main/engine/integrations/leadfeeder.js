/**
 * Leadfeeder (Dealfront) Website Visitor Tracking API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function lfReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.leadfeeder.com', path: `/api${path}`, headers: { 'Authorization': `Token token="${creds.api_token}"`, 'Accept': 'application/vnd.api+json', ...(bodyStr && { 'Content-Type': 'application/vnd.api+json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'leadfeeder',
  name: 'Leadfeeder',
  category: 'marketing',
  icon: 'Eye',
  description: 'Identify anonymous website visitors and convert them to qualified B2B leads with Leadfeeder.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lfReq('GET', '/v1/accounts', null, creds); return { success: true, message: `${(r.data || []).length} account(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_accounts: async (params, creds) => lfReq('GET', '/v1/accounts', null, creds),
    list_leads: async (params, creds) => {
      if (!params.account_id) throw new Error('account_id required');
      return lfReq('GET', `/v1/accounts/${params.account_id}/leads?page[number]=${params.page || 1}&page[size]=${params.per_page || 25}`, null, creds);
    },
    get_lead: async (params, creds) => {
      if (!params.account_id || !params.lead_id) throw new Error('account_id and lead_id required');
      return lfReq('GET', `/v1/accounts/${params.account_id}/leads/${params.lead_id}`, null, creds);
    },
    list_visits: async (params, creds) => {
      if (!params.account_id || !params.lead_id) throw new Error('account_id and lead_id required');
      return lfReq('GET', `/v1/accounts/${params.account_id}/leads/${params.lead_id}/visits?page[number]=${params.page || 1}`, null, creds);
    },
    list_custom_fields: async (params, creds) => {
      if (!params.account_id) throw new Error('account_id required');
      return lfReq('GET', `/v1/accounts/${params.account_id}/custom_fields`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
