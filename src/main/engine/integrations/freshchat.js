/**
 * Freshchat (Freshworks) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fcReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: `${creds.subdomain}.freshchat.com`, path: `/v2${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'freshchat',
  name: 'Freshchat',
  category: 'support',
  icon: 'MessageSquare',
  description: 'Manage conversations, users, and agents in Freshchat messaging platform.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain (e.g. mycompany)', type: 'text', required: true },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.api_token) throw new Error('subdomain and api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fcReq('GET', '/agents?page=1&items_per_page=1', null, creds); return { success: true, message: `Connected — total agents: ${r.pagination?.total_items ?? 0}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => fcReq('GET', `/conversations?page=${params.page || 1}&items_per_page=${params.per_page || 25}`, null, creds),
    get_conversation: async (params, creds) => {
      if (!params.conversation_id) throw new Error('conversation_id required');
      return fcReq('GET', `/conversations/${params.conversation_id}`, null, creds);
    },
    send_message: async (params, creds) => {
      if (!params.conversation_id || !params.message) throw new Error('conversation_id and message required');
      return fcReq('POST', `/conversations/${params.conversation_id}/messages`, { message_parts: [{ text: { content: params.message } }], actor_type: 'agent', actor_id: params.actor_id }, creds);
    },
    list_users: async (params, creds) => fcReq('GET', `/users?page=${params.page || 1}&items_per_page=${params.per_page || 25}`, null, creds),
    list_agents: async (params, creds) => fcReq('GET', `/agents?page=${params.page || 1}&items_per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
