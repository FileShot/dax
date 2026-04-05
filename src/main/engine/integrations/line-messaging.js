/**
 * LINE Messaging API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function lineReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.line.me', path: `/v2/bot${path}`, headers: { 'Authorization': `Bearer ${creds.channel_access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'line-messaging',
  name: 'LINE Messaging',
  category: 'communication',
  icon: 'MessageCircle',
  description: 'Send push/reply messages, get user profiles, and manage LINE bot channels.',
  configFields: [{ key: 'channel_access_token', label: 'Channel Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.channel_access_token) throw new Error('channel_access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lineReq('GET', '/info', null, creds); return { success: true, message: `Bot: ${r.displayName || r.userId}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    push_message: async (params, creds) => {
      if (!params.to || !params.messages) throw new Error('to and messages required');
      return lineReq('POST', '/message/push', { to: params.to, messages: Array.isArray(params.messages) ? params.messages : [{ type: 'text', text: params.messages }] }, creds);
    },
    reply_message: async (params, creds) => {
      if (!params.reply_token || !params.messages) throw new Error('reply_token and messages required');
      return lineReq('POST', '/message/reply', { replyToken: params.reply_token, messages: Array.isArray(params.messages) ? params.messages : [{ type: 'text', text: params.messages }] }, creds);
    },
    get_profile: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return lineReq('GET', `/profile/${params.user_id}`, null, creds);
    },
    broadcast: async (params, creds) => {
      if (!params.messages) throw new Error('messages required');
      return lineReq('POST', '/message/broadcast', { messages: Array.isArray(params.messages) ? params.messages : [{ type: 'text', text: params.messages }] }, creds);
    },
    get_quota: async (params, creds) => lineReq('GET', '/message/quota', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
