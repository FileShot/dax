/**
 * Matrix (Element) API Integration
 */
'use strict';
const https = require('https');

function matrixApi(method, server, path, token, body = null) {
  const url = new URL(server);
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: url.hostname, port: url.port || 443, path: `/_matrix/client/v3${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'matrix',
  name: 'Matrix',
  category: 'communication',
  icon: 'Hash',
  description: 'Send messages and manage rooms on any Matrix homeserver.',
  configFields: [
    { key: 'homeserver', label: 'Homeserver URL (e.g. https://matrix.org)', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.homeserver || !creds.access_token) throw new Error('Homeserver and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await matrixApi('GET', creds.homeserver, '/account/whoami', creds.access_token); return { success: !!r.user_id, message: r.user_id ? `Authenticated as ${r.user_id}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_message: async (params, creds) => {
      if (!params.room_id || !params.text) throw new Error('room_id and text required');
      const txnId = Date.now() + '_' + Math.random().toString(36).slice(2);
      return matrixApi('PUT', creds.homeserver, `/rooms/${encodeURIComponent(params.room_id)}/send/m.room.message/${txnId}`, creds.access_token, { msgtype: params.msgtype || 'm.text', body: params.text, ...(params.formatted_body ? { format: 'org.matrix.custom.html', formatted_body: params.formatted_body } : {}) });
    },
    get_messages: async (params, creds) => {
      if (!params.room_id) throw new Error('room_id required');
      const limit = params.limit || 20;
      return matrixApi('GET', creds.homeserver, `/rooms/${encodeURIComponent(params.room_id)}/messages?dir=b&limit=${limit}`, creds.access_token);
    },
    list_rooms: async (params, creds) => matrixApi('GET', creds.homeserver, '/joined_rooms', creds.access_token),
    join_room: async (params, creds) => {
      if (!params.room_id) throw new Error('room_id required');
      return matrixApi('POST', creds.homeserver, `/join/${encodeURIComponent(params.room_id)}`, creds.access_token);
    },
    create_room: async (params, creds) => {
      const body = { visibility: params.visibility || 'private' };
      if (params.name) body.name = params.name;
      if (params.topic) body.topic = params.topic;
      if (params.invite) body.invite = params.invite;
      return matrixApi('POST', creds.homeserver, '/createRoom', creds.access_token, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
