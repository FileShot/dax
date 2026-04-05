/**
 * Chatwoot API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function cwReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = (creds.instance_url || 'app.chatwoot.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { method, hostname: host, path: `/api/v1${path}`, headers: { 'api_access_token': creds.api_token, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'chatwoot',
  name: 'Chatwoot',
  category: 'support',
  icon: 'MessageSquare',
  description: 'Open-source customer messaging — manage conversations, contacts, and inboxes in Chatwoot.',
  configFields: [
    { key: 'instance_url', label: 'Instance URL (default: app.chatwoot.com)', type: 'text', required: false },
    { key: 'api_token', label: 'User Access Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_token || !creds.account_id) throw new Error('api_token and account_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cwReq('GET', `/accounts/${creds.account_id}/conversations?page=1`, null, creds); return { success: true, message: `Connected — account ${creds.account_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => cwReq('GET', `/accounts/${creds.account_id}/conversations?page=${params.page || 1}&status=${params.status || 'open'}`, null, creds),
    get_conversation: async (params, creds) => {
      if (!params.conversation_id) throw new Error('conversation_id required');
      return cwReq('GET', `/accounts/${creds.account_id}/conversations/${params.conversation_id}`, null, creds);
    },
    send_message: async (params, creds) => {
      if (!params.conversation_id || !params.content) throw new Error('conversation_id and content required');
      return cwReq('POST', `/accounts/${creds.account_id}/conversations/${params.conversation_id}/messages`, { content: params.content, message_type: params.message_type || 'outgoing', private: params.private || false }, creds);
    },
    list_contacts: async (params, creds) => cwReq('GET', `/accounts/${creds.account_id}/contacts?page=${params.page || 1}&q=${encodeURIComponent(params.q || '')}`, null, creds),
    search_conversations: async (params, creds) => {
      if (!params.q) throw new Error('search query required');
      return cwReq('GET', `/accounts/${creds.account_id}/conversations/search?q=${encodeURIComponent(params.q)}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
