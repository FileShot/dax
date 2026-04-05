/**
 * Dixa Customer Service API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dixaReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'dev.dixa.io', path: `/v1${path}`, headers: { 'Authorization': creds.api_token, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'dixa',
  name: 'Dixa',
  category: 'support',
  icon: 'MessageCircle',
  description: 'Manage conversations, agents, and queues in Dixa customer service platform.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dixaReq('GET', '/agents?limit=1', null, creds); return { success: true, message: `Connected — agents found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => dixaReq('GET', `/conversations?limit=${params.limit || 25}&sort=created_at:desc`, null, creds),
    get_conversation: async (params, creds) => {
      if (!params.conversation_id) throw new Error('conversation_id required');
      return dixaReq('GET', `/conversations/${params.conversation_id}`, null, creds);
    },
    list_agents: async (params, creds) => dixaReq('GET', `/agents?limit=${params.limit || 25}`, null, creds),
    list_queues: async (params, creds) => dixaReq('GET', '/queues', null, creds),
    search_conversations: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return dixaReq('GET', `/conversations/search?query=${encodeURIComponent(params.query)}&limit=${params.limit || 25}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
