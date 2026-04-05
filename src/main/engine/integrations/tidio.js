/**
 * Tidio Live Chat API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function tidioReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'www.tidio.com', path: `/api${path}`, headers: { 'Authorization': `Bearer ${creds.public_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'tidio',
  name: 'Tidio',
  category: 'support',
  icon: 'MessageCircle',
  description: 'Manage conversations, contacts, and operators in Tidio live chat and chatbot.',
  configFields: [{ key: 'public_key', label: 'Public API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.public_key) throw new Error('public_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tidioReq('GET', '/v1/conversations?limit=1', null, creds); return { success: true, message: `Connected to Tidio` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => tidioReq('GET', `/v1/conversations?limit=${params.limit || 25}&offset=${params.offset || 0}&status=${params.status || ''}`, null, creds),
    get_conversation: async (params, creds) => {
      if (!params.conversation_id) throw new Error('conversation_id required');
      return tidioReq('GET', `/v1/conversations/${params.conversation_id}`, null, creds);
    },
    send_message: async (params, creds) => {
      if (!params.conversation_id || !params.message) throw new Error('conversation_id and message required');
      return tidioReq('POST', `/v1/conversations/${params.conversation_id}/messages`, { message: params.message, type: params.type || 'chat' }, creds);
    },
    list_contacts: async (params, creds) => tidioReq('GET', `/v1/contacts?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    list_operators: async (params, creds) => tidioReq('GET', '/v1/operators', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
