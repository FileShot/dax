/**
 * AWeber Email Marketing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function awReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.aweber.com', path: `/1.0${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'aweber',
  name: 'AWeber',
  category: 'marketing',
  icon: 'Megaphone',
  description: 'Manage AWeber email lists, subscribers, campaigns, and broadcasts.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.account_id) throw new Error('access_token and account_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await awReq('GET', `/accounts/${creds.account_id}`, null, creds); return { success: true, message: `AWeber connected` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_lists: async (params, creds) => awReq('GET', `/accounts/${creds.account_id}/lists?ws.size=${params.size || 100}`, null, creds),
    get_list: async (params, creds) => {
      if (!params.list_id) throw new Error('list_id required');
      return awReq('GET', `/accounts/${creds.account_id}/lists/${params.list_id}`, null, creds);
    },
    list_subscribers: async (params, creds) => {
      if (!params.list_id) throw new Error('list_id required');
      return awReq('GET', `/accounts/${creds.account_id}/lists/${params.list_id}/subscribers?ws.size=${params.size || 100}&ws.status=${params.status || 'subscribed'}`, null, creds);
    },
    add_subscriber: async (params, creds) => {
      if (!params.list_id || !params.email) throw new Error('list_id and email required');
      return awReq('POST', `/accounts/${creds.account_id}/lists/${params.list_id}/subscribers`, { email: params.email, name: params.name || '', custom_fields: params.custom_fields || {} }, creds);
    },
    get_broadcasts: async (params, creds) => {
      if (!params.list_id) throw new Error('list_id required');
      return awReq('GET', `/accounts/${creds.account_id}/lists/${params.list_id}/broadcasts?ws.size=${params.size || 20}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
