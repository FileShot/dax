/**
 * Lemlist Cold Outreach API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function lemReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`:${creds.api_key}`).toString('base64');
  const opts = { method, hostname: 'api.lemlist.com', path: `/api${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'lemlist',
  name: 'Lemlist',
  category: 'marketing',
  icon: 'Mail',
  description: 'Manage cold email campaigns, leads, and sequences with Lemlist.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lemReq('GET', '/team', null, creds); return { success: true, message: `Team: ${r.name || r._id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_campaigns: async (params, creds) => lemReq('GET', '/campaigns', null, creds),
    get_campaign: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return lemReq('GET', `/campaigns/${params.campaign_id}`, null, creds);
    },
    add_lead: async (params, creds) => {
      if (!params.campaign_id || !params.email) throw new Error('campaign_id and email required');
      return lemReq('POST', `/campaigns/${params.campaign_id}/leads/${encodeURIComponent(params.email)}`, { firstName: params.first_name, lastName: params.last_name, companyName: params.company }, creds);
    },
    get_lead_activity: async (params, creds) => {
      if (!params.campaign_id || !params.email) throw new Error('campaign_id and email required');
      return lemReq('GET', `/campaigns/${params.campaign_id}/leads/${encodeURIComponent(params.email)}/activity`, null, creds);
    },
    get_team_stats: async (params, creds) => lemReq('GET', '/team', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
