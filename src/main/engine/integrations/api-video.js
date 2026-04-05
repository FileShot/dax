/**
 * api.video Video Hosting API Integration
 */
'use strict';
const { TokenCache, makeRequest } = require('../../engine/integration-utils');

const _tokenCache = new TokenCache(3500);

async function getToken(creds) {
  const key = `apivideo:${creds.api_key}`;
  if (_tokenCache.get(key)) return _tokenCache.get(key);
  const body = JSON.stringify({ apiKey: creds.api_key });
  const opts = { method: 'POST', hostname: 'ws.api.video', path: '/auth/api-key', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
  const r = await makeRequest(opts, body);
  _tokenCache.set(key, r.access_token);
  return r.access_token;
}

async function avReq(method, path, body, creds) {
  const token = await getToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'ws.api.video', path, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'api-video',
  name: 'api.video',
  category: 'video',
  icon: 'Film',
  description: 'Upload, stream, and manage videos with the api.video programmable video platform.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds); return { success: true, message: 'Token obtained' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_videos: async (params, creds) => avReq('GET', `/videos?currentPage=${params.page || 1}&pageSize=${params.page_size || 25}&title=${params.title || ''}`, null, creds),
    get_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      return avReq('GET', `/videos/${params.video_id}`, null, creds);
    },
    create_video: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return avReq('POST', '/videos', { title: params.title, description: params.description, public: params.public ?? true, mp4Support: params.mp4_support ?? true }, creds);
    },
    get_video_status: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      return avReq('GET', `/videos/${params.video_id}/status`, null, creds);
    },
    list_live_streams: async (params, creds) => avReq('GET', `/live-streams?currentPage=${params.page || 1}&pageSize=${params.page_size || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
