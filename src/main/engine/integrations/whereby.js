/**
 * Whereby Embedded Video API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function wherebyReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.whereby.dev', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'whereby',
  name: 'Whereby',
  category: 'video',
  icon: 'Video',
  description: 'Embed video meetings and manage rooms programmatically with Whereby.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await wherebyReq('GET', '/meetings?limit=1', null, creds); return { success: true, message: 'Connected to Whereby' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_meetings: async (params, creds) => wherebyReq('GET', `/meetings?limit=${params.limit || 20}`, null, creds),
    create_meeting: async (params, creds) => {
      if (!params.end_date) throw new Error('end_date required (ISO 8601)');
      return wherebyReq('POST', '/meetings', { endDate: params.end_date, startDate: params.start_date, roomNameprefix: params.room_prefix, fields: params.fields || [] }, creds);
    },
    get_meeting: async (params, creds) => {
      if (!params.meeting_id) throw new Error('meeting_id required');
      return wherebyReq('GET', `/meetings/${params.meeting_id}`, null, creds);
    },
    delete_meeting: async (params, creds) => {
      if (!params.meeting_id) throw new Error('meeting_id required');
      return wherebyReq('DELETE', `/meetings/${params.meeting_id}`, null, creds);
    },
    list_insights_rooms: async (params, creds) => wherebyReq('GET', `/insights/rooms?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    get_room_insights: async (params, creds) => {
      if (!params.room_name) throw new Error('room_name required');
      return wherebyReq('GET', `/insights/rooms/${encodeURIComponent(params.room_name)}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
