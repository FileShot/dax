/**
 * Telnyx Cloud Communications API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function telnyxReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.telnyx.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'telnyx',
  name: 'Telnyx',
  category: 'communication',
  icon: 'Phone',
  description: 'Send SMS/MMS, make voice calls, and manage phone numbers via Telnyx API.',
  configFields: [{ key: 'api_key', label: 'API Key (V2)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await telnyxReq('GET', '/messaging_profiles?page[size]=1', null, creds); return { success: true, message: `Connected — ${r.meta?.total_results ?? 0} messaging profile(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_sms: async (params, creds) => {
      if (!params.to || !params.from || !params.text) throw new Error('to, from, and text required');
      return telnyxReq('POST', '/messages', { to: params.to, from: params.from, text: params.text, messaging_profile_id: params.messaging_profile_id, type: 'SMS' }, creds);
    },
    list_messages: async (params, creds) => telnyxReq('GET', `/messages?page[size]=${params.page_size || 25}`, null, creds),
    get_message: async (params, creds) => {
      if (!params.id) throw new Error('message id required');
      return telnyxReq('GET', `/messages/${params.id}`, null, creds);
    },
    list_phone_numbers: async (params, creds) => telnyxReq('GET', `/phone_numbers?page[size]=${params.page_size || 25}`, null, creds),
    list_messaging_profiles: async (params, creds) => telnyxReq('GET', `/messaging_profiles?page[size]=${params.page_size || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
