/**
 * Brightcove Video Cloud API Integration
 */
'use strict';
const { TokenCache, makeRequest } = require('../../engine/integration-utils');

const _tokenCache = new TokenCache(290);

async function getToken(creds) {
  const key = `brightcove:${creds.client_id}`;
  if (_tokenCache.get(key)) return _tokenCache.get(key);
  const basic = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
  const body = 'grant_type=client_credentials';
  const opts = { method: 'POST', hostname: 'oauth.brightcove.com', path: '/v4/access_token', headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
  const r = await makeRequest(opts, body);
  _tokenCache.set(key, r.access_token);
  return r.access_token;
}

async function bcReq(method, service, path, body, creds) {
  const token = await getToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: `${service}.brightcove.com`, path: `/v1/accounts/${creds.account_id}${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'brightcove',
  name: 'Brightcove',
  category: 'video',
  icon: 'Play',
  description: 'Manage video uploads, playlists, and analytics with Brightcove Video Cloud.',
  configFields: [
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.account_id || !creds.client_id || !creds.client_secret) throw new Error('account_id, client_id, client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bcReq('GET', 'cms', '/videos?limit=1', null, creds); return { success: true, message: `Account ${creds.account_id} connected` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_videos: async (params, creds) => bcReq('GET', 'cms', `/videos?limit=${params.limit || 25}&offset=${params.offset || 0}&q=${params.q || ''}`, null, creds),
    get_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      return bcReq('GET', 'cms', `/videos/${params.video_id}`, null, creds);
    },
    list_playlists: async (params, creds) => bcReq('GET', 'cms', `/playlists?limit=${params.limit || 25}`, null, creds),
    get_video_sources: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      return bcReq('GET', 'cms', `/videos/${params.video_id}/sources`, null, creds);
    },
    get_analytics: async (params, creds) => {
      const from = params.from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const to = params.to || new Date().toISOString().split('T')[0];
      const opts = { method: 'GET', hostname: 'analytics.api.brightcove.com', path: `/v1/data?accounts=${creds.account_id}&dimensions=${params.dimensions || 'video'}&from=${from}&to=${to}&limit=${params.limit || 25}`, headers: { 'Authorization': `Bearer ${await getToken(creds)}` } };
      return makeRequest(opts, null);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
