/**
 * Mattermost API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function mmReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = (creds.server_url || 'https://mattermost.example.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { method, hostname: host, path: `/api/v4${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'mattermost',
  name: 'Mattermost',
  category: 'communication',
  icon: 'Hash',
  description: 'Post messages, manage channels, and access users in self-hosted or cloud Mattermost.',
  configFields: [
    { key: 'server_url', label: 'Server URL', type: 'text', required: true },
    { key: 'access_token', label: 'Bot or User Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.server_url || !creds.access_token) throw new Error('server_url and access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mmReq('GET', '/users/me', null, creds); return { success: true, message: `Logged in as ${r.username}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    post_message: async (params, creds) => {
      if (!params.channel_id || !params.message) throw new Error('channel_id and message required');
      return mmReq('POST', '/posts', { channel_id: params.channel_id, message: params.message, props: params.props, root_id: params.root_id }, creds);
    },
    list_channels: async (params, creds) => {
      if (!params.team_id) throw new Error('team_id required');
      return mmReq('GET', `/teams/${params.team_id}/channels?page=${params.page || 0}&per_page=${params.per_page || 60}`, null, creds);
    },
    list_posts: async (params, creds) => {
      if (!params.channel_id) throw new Error('channel_id required');
      return mmReq('GET', `/channels/${params.channel_id}/posts?page=${params.page || 0}&per_page=${params.per_page || 60}`, null, creds);
    },
    get_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return mmReq('GET', `/users/${params.user_id}`, null, creds);
    },
    list_teams: async (params, creds) => mmReq('GET', '/teams', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
