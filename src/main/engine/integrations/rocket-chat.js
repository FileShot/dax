/**
 * Rocket.Chat API Integration (self-hosted or cloud)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function rcReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = (creds.server_url || 'https://open.rocket.chat').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { method, hostname: host, path: `/api/v1${path}`, headers: { 'X-Auth-Token': creds.auth_token, 'X-User-Id': creds.user_id, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'rocket-chat',
  name: 'Rocket.Chat',
  category: 'communication',
  icon: 'MessageSquare',
  description: 'Send messages, manage channels, and access users in Rocket.Chat (self-hosted or cloud).',
  configFields: [
    { key: 'server_url', label: 'Server URL', type: 'text', required: true },
    { key: 'user_id', label: 'User ID', type: 'text', required: true },
    { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.server_url || !creds.user_id || !creds.auth_token) throw new Error('server_url, user_id, and auth_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rcReq('GET', '/me', null, creds); return { success: true, message: `Logged in as ${r.username || r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_message: async (params, creds) => {
      if (!params.channel || !params.text) throw new Error('channel and text required');
      return rcReq('POST', '/chat.postMessage', { channel: params.channel, text: params.text, alias: params.alias, avatar: params.avatar }, creds);
    },
    list_channels: async (params, creds) => rcReq('GET', `/channels.list?count=${params.count || 50}&offset=${params.offset || 0}`, null, creds),
    list_messages: async (params, creds) => {
      if (!params.room_id) throw new Error('room_id required');
      return rcReq('GET', `/channels.messages?roomId=${params.room_id}&count=${params.count || 50}`, null, creds);
    },
    get_user_info: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      return rcReq('GET', `/users.info?username=${encodeURIComponent(params.username)}`, null, creds);
    },
    create_channel: async (params, creds) => {
      if (!params.name) throw new Error('channel name required');
      return rcReq('POST', '/channels.create', { name: params.name, members: params.members || [], readOnly: params.read_only || false }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
