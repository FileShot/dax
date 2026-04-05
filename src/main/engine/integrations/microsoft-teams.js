/**
 * Microsoft Teams API Integration (via Microsoft Graph)
 */
'use strict';
const https = require('https');

function graphApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'graph.microsoft.com', path: `/v1.0${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'microsoft-teams',
  name: 'Microsoft Teams',
  category: 'communication',
  icon: 'Users',
  description: 'Send messages and manage Microsoft Teams channels.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await graphApi('GET', '/me', creds.access_token); return { success: !!r.id, message: r.id ? `Authenticated as ${r.displayName}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_teams: async (params, creds) => graphApi('GET', '/me/joinedTeams', creds.access_token),
    list_channels: async (params, creds) => {
      if (!params.team_id) throw new Error('team_id required');
      return graphApi('GET', `/teams/${params.team_id}/channels`, creds.access_token);
    },
    send_message: async (params, creds) => {
      if (!params.team_id || !params.channel_id || !params.text) throw new Error('team_id, channel_id, and text required');
      return graphApi('POST', `/teams/${params.team_id}/channels/${params.channel_id}/messages`, creds.access_token, { body: { content: params.text, contentType: 'text' } });
    },
    get_messages: async (params, creds) => {
      if (!params.team_id || !params.channel_id) throw new Error('team_id and channel_id required');
      return graphApi('GET', `/teams/${params.team_id}/channels/${params.channel_id}/messages?$top=${params.limit || 20}`, creds.access_token);
    },
    send_chat: async (params, creds) => {
      if (!params.chat_id || !params.text) throw new Error('chat_id and text required');
      return graphApi('POST', `/chats/${params.chat_id}/messages`, creds.access_token, { body: { content: params.text, contentType: 'text' } });
    },
    list_chats: async (params, creds) => graphApi('GET', `/me/chats?$top=${params.limit || 20}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
