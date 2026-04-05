/**
 * Cisco Webex API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function webexReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'webexapis.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'webex',
  name: 'Webex',
  category: 'communication',
  icon: 'Video',
  description: 'Send messages, manage rooms, and schedule meetings with Cisco Webex.',
  configFields: [{ key: 'access_token', label: 'Bot or Personal Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await webexReq('GET', '/people/me', null, creds); return { success: true, message: `Connected as ${r.displayName || r.emails?.[0]}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_message: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      return webexReq('POST', '/messages', { roomId: params.room_id, toPersonId: params.to_person_id, toPersonEmail: params.to_person_email, text: params.text, markdown: params.markdown }, creds);
    },
    list_rooms: async (params, creds) => webexReq('GET', `/rooms?max=${params.max || 50}&type=${params.type || 'direct'}`, null, creds),
    list_messages: async (params, creds) => {
      if (!params.room_id) throw new Error('room_id required');
      return webexReq('GET', `/messages?roomId=${params.room_id}&max=${params.max || 50}`, null, creds);
    },
    create_meeting: async (params, creds) => {
      if (!params.title || !params.start || !params.end) throw new Error('title, start, end required');
      return webexReq('POST', '/meetings', { title: params.title, start: params.start, end: params.end, invitees: params.invitees || [] }, creds);
    },
    get_me: async (params, creds) => webexReq('GET', '/people/me', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
