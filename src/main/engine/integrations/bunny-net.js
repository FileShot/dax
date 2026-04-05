/**
 * Bunny.net CDN & Video API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bunnyReq(method, hostname, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname, path, headers: { 'AccessKey': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'bunny-net',
  name: 'Bunny.net',
  category: 'video',
  icon: 'Zap',
  description: 'Manage CDN storage zones, video libraries, and stream videos with Bunny.net.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bunnyReq('GET', 'api.bunny.net', '/storagezone?page=1&perPage=1', null, creds); return { success: true, message: `Connected — ${r.TotalItems ?? 0} storage zone(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_storage_zones: async (params, creds) => bunnyReq('GET', 'api.bunny.net', `/storagezone?page=${params.page || 1}&perPage=${params.per_page || 25}`, null, creds),
    list_video_libraries: async (params, creds) => bunnyReq('GET', 'api.bunny.net', `/videolibrary?page=${params.page || 1}&perPage=${params.per_page || 25}`, null, creds),
    get_video_library: async (params, creds) => {
      if (!params.library_id) throw new Error('library_id required');
      return bunnyReq('GET', 'api.bunny.net', `/videolibrary/${params.library_id}`, null, creds);
    },
    list_videos: async (params, creds) => {
      if (!params.library_id) throw new Error('library_id required');
      const libKey = params.library_api_key || creds.api_key;
      const opts = { method: 'GET', hostname: 'video.bunnycdn.com', path: `/library/${params.library_id}/videos?page=${params.page || 1}&itemsPerPage=${params.per_page || 25}`, headers: { 'AccessKey': libKey, 'Accept': 'application/json' } };
      return makeRequest(opts, null);
    },
    get_cdn_stats: async (params, creds) => bunnyReq('GET', 'api.bunny.net', `/statistics?dateFrom=${params.from || ''}&dateTo=${params.to || ''}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
