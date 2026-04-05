/**
 * Daily.co Video API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dailyReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.daily.co', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'daily-co',
  name: 'Daily.co',
  category: 'video',
  icon: 'Video',
  description: 'Create and manage video rooms, recordings, and meetings via Daily.co.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dailyReq('GET', '/rooms?limit=1', null, creds); return { success: true, message: `Connected — ${r.total_count ?? 0} room(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_rooms: async (params, creds) => dailyReq('GET', `/rooms?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    create_room: async (params, creds) => dailyReq('POST', '/rooms', { name: params.name, privacy: params.privacy || 'public', properties: params.properties || {} }, creds),
    get_room: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return dailyReq('GET', `/rooms/${params.name}`, null, creds);
    },
    delete_room: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return dailyReq('DELETE', `/rooms/${params.name}`, null, creds);
    },
    list_recordings: async (params, creds) => dailyReq('GET', `/recordings?room_name=${params.room_name || ''}&limit=${params.limit || 20}`, null, creds),
    create_meeting_token: async (params, creds) => {
      if (!params.room_name) throw new Error('room_name required');
      return dailyReq('POST', '/meeting-tokens', { properties: { room_name: params.room_name, is_owner: params.is_owner || false, exp: params.exp } }, creds);
    },
    get_domain_config: async (params, creds) => dailyReq('GET', '/domains/me', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
