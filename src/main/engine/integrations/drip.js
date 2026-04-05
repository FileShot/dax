/**
 * Drip Email Automation API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dripReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = 'Basic ' + Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname: 'api.getdrip.com', path, headers: { 'Authorization': auth, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'drip',
  name: 'Drip',
  category: 'marketing',
  icon: 'Droplets',
  description: 'Manage Drip email automation — subscribers, campaigns, workflows, and tags.',
  configFields: [
    { key: 'api_key', label: 'API Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.account_id) throw new Error('api_key and account_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dripReq('GET', `/v2/${creds.account_id}/account`, null, creds); return { success: true, message: `Connected: ${r.accounts?.[0]?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_subscribers: async (params, creds) => dripReq('GET', `/v2/${creds.account_id}/subscribers?per_page=${params.per_page || 100}`, null, creds),
    get_subscriber: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return dripReq('GET', `/v2/${creds.account_id}/subscribers/${encodeURIComponent(params.email)}`, null, creds);
    },
    create_or_update_subscriber: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return dripReq('POST', `/v2/${creds.account_id}/subscribers`, { subscribers: [{ email: params.email, ...params.attributes }] }, creds);
    },
    tag_subscriber: async (params, creds) => {
      if (!params.email || !params.tag) throw new Error('email and tag required');
      return dripReq('POST', `/v2/${creds.account_id}/tags`, { tags: [{ email: params.email, tag: params.tag }] }, creds);
    },
    list_campaigns: async (params, creds) => dripReq('GET', `/v2/${creds.account_id}/campaigns?status=${params.status || 'active'}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
