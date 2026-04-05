/**
 * Vidyard Video Platform API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function vyReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.vidyard.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'vidyard',
  name: 'Vidyard',
  category: 'video',
  icon: 'Video',
  description: 'Manage videos, track viewer analytics, and personalize content with Vidyard.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await vyReq('GET', '/players?page=1&per_page=1', null, creds); return { success: true, message: `Connected — ${r.total_entries ?? 0} player(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_players: async (params, creds) => vyReq('GET', `/players?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    get_player: async (params, creds) => {
      if (!params.player_uuid) throw new Error('player_uuid required');
      return vyReq('GET', `/players/${params.player_uuid}`, null, creds);
    },
    list_videos: async (params, creds) => vyReq('GET', `/videos?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    get_video_stats: async (params, creds) => {
      if (!params.player_uuid) throw new Error('player_uuid required');
      return vyReq('GET', `/analytics/players/${params.player_uuid}/data`, null, creds);
    },
    list_chapters: async (params, creds) => {
      if (!params.player_uuid) throw new Error('player_uuid required');
      return vyReq('GET', `/chapterized_players/${params.player_uuid}/chapters`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
