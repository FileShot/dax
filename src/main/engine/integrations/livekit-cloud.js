/**
 * LiveKit Cloud Video API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

// LiveKit Cloud REST API — project management & server-side token gen
async function lkReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.server_host || 'cloud.livekit.io';
  const opts = { method, hostname: host, path: `/api${path}`, headers: { 'Authorization': `Bearer ${creds.api_secret}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'livekit-cloud',
  name: 'LiveKit',
  category: 'video',
  icon: 'Video',
  description: 'Manage LiveKit rooms, participants, and generate access tokens for real-time video/audio.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'string', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
    { key: 'server_host', label: 'Server Host', type: 'string', required: false, description: 'e.g. your-project.livekit.cloud (defaults to cloud.livekit.io)' },
  ],
  async connect(creds) { if (!creds.api_key || !creds.api_secret) throw new Error('api_key and api_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lkReq('GET', '/rooms', null, creds); return { success: true, message: `Connected — ${r.rooms?.length ?? 0} room(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_rooms: async (params, creds) => lkReq('GET', `/rooms${params.room_name ? `?names=${encodeURIComponent(params.room_name)}` : ''}`, null, creds),
    create_room: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return lkReq('POST', '/rooms', { name: params.name, empty_timeout: params.empty_timeout || 300, max_participants: params.max_participants || 0 }, creds);
    },
    delete_room: async (params, creds) => {
      if (!params.room) throw new Error('room required');
      return lkReq('POST', '/rooms/delete', { room: params.room }, creds);
    },
    list_participants: async (params, creds) => {
      if (!params.room) throw new Error('room required');
      return lkReq('GET', `/rooms/${encodeURIComponent(params.room)}/participants`, null, creds);
    },
    remove_participant: async (params, creds) => {
      if (!params.room || !params.identity) throw new Error('room and identity required');
      return lkReq('POST', `/rooms/${encodeURIComponent(params.room)}/participants/${encodeURIComponent(params.identity)}/remove`, {}, creds);
    },
    mute_track: async (params, creds) => {
      if (!params.room || !params.identity || !params.track_sid) throw new Error('room, identity, and track_sid required');
      return lkReq('POST', `/rooms/${encodeURIComponent(params.room)}/participants/${encodeURIComponent(params.identity)}/tracks/${params.track_sid}`, { muted: params.muted !== false }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
