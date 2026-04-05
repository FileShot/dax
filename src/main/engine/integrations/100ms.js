/**
 * 100ms Video API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getToken(creds) {
  return _cache.get(`100ms:${creds.app_access_key}`, async () => {
    // 100ms uses HS256 JWT with management token
    // For simplicity: use access token directly if provided, else require it
    if (!creds.management_token) throw new Error('management_token required (generate from dashboard or using SDK)');
    return { token: creds.management_token, expiresAt: Date.now() + 3600000 };
  });
}

async function hmsReq(method, path, body, creds) {
  const token = await getToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.100ms.live', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: '100ms',
  name: '100ms',
  category: 'video',
  icon: 'Video',
  description: 'Build live video/audio experiences and manage rooms with 100ms.',
  configFields: [
    { key: 'management_token', label: 'Management Token', type: 'password', required: true, description: 'JWT management token from the 100ms dashboard' },
  ],
  async connect(creds) { if (!creds.management_token) throw new Error('management_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hmsReq('GET', '/rooms?limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} room(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_rooms: async (params, creds) => hmsReq('GET', `/rooms?limit=${params.limit || 20}${params.after ? `&start=${params.after}` : ''}`, null, creds),
    create_room: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return hmsReq('POST', '/rooms', { name: params.name, description: params.description, template_id: params.template_id }, creds);
    },
    get_room: async (params, creds) => {
      if (!params.room_id) throw new Error('room_id required');
      return hmsReq('GET', `/rooms/${params.room_id}`, null, creds);
    },
    list_sessions: async (params, creds) => {
      if (!params.room_id) throw new Error('room_id required');
      return hmsReq('GET', `/sessions?room_id=${params.room_id}&limit=${params.limit || 20}`, null, creds);
    },
    get_session: async (params, creds) => {
      if (!params.session_id) throw new Error('session_id required');
      return hmsReq('GET', `/sessions/${params.session_id}`, null, creds);
    },
    list_recordings: async (params, creds) => hmsReq('GET', `/recordings?room_id=${params.room_id || ''}&limit=${params.limit || 20}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
