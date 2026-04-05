/**
 * Reply.io Sales Engagement API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function replyReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.reply.io', path: `/v1${path}`, headers: { 'X-Api-Key': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'reply-io',
  name: 'Reply.io',
  category: 'marketing',
  icon: 'Send',
  description: 'Run multichannel sales sequences, manage contacts, and track replies in Reply.io.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await replyReq('GET', '/people?page=1&limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.totalCount ?? 0} people` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_campaigns: async (params, creds) => replyReq('GET', `/campaigns?page=${params.page || 1}&limit=${params.limit || 25}`, null, creds),
    get_campaign: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return replyReq('GET', `/campaigns/${params.campaign_id}`, null, creds);
    },
    list_people: async (params, creds) => replyReq('GET', `/people?page=${params.page || 1}&limit=${params.limit || 25}`, null, creds),
    add_person_to_campaign: async (params, creds) => {
      if (!params.campaign_id || !params.email) throw new Error('campaign_id and email required');
      return replyReq('POST', `/people`, { email: params.email, firstName: params.first_name, lastName: params.last_name, campaignId: params.campaign_id }, creds);
    },
    push_to_dialer: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return replyReq('POST', `/people/push-to-dialer`, { email: params.email }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
