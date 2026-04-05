/**
 * Kustomer CRM/Support API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function kustReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.kustomer.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'kustomer',
  name: 'Kustomer',
  category: 'support',
  icon: 'Users',
  description: 'Manage conversations, customers, and messages in Kustomer CRM/helpdesk.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await kustReq('GET', '/customers?page[size]=1', null, creds); return { success: true, message: `Connected — ${r.meta?.total ?? 0} customer(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => kustReq('GET', `/conversations?page[size]=${params.page_size || 25}&sort=${params.sort || 'lastActivity'}`, null, creds),
    get_conversation: async (params, creds) => {
      if (!params.conversation_id) throw new Error('conversation_id required');
      return kustReq('GET', `/conversations/${params.conversation_id}`, null, creds);
    },
    get_customer: async (params, creds) => {
      if (!params.customer_id) throw new Error('customer_id required');
      return kustReq('GET', `/customers/${params.customer_id}`, null, creds);
    },
    search_customers: async (params, creds) => {
      if (!params.query) throw new Error('query required (JSON Kustomer query)');
      return kustReq('POST', '/customers/search', { query: params.query, page: { size: params.page_size || 25 } }, creds);
    },
    send_message: async (params, creds) => {
      if (!params.conversation_id || !params.body) throw new Error('conversation_id and body required');
      return kustReq('POST', `/conversations/${params.conversation_id}/messages`, { body: params.body, channel: params.channel || 'chat', direction: 'out' }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
