/**
 * TikTok API Integration (Display & Research API)
 */
'use strict';
const https = require('https');

function tiktokReq(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'open.tiktokapis.com', path, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'tiktok',
  name: 'TikTok',
  category: 'social',
  icon: 'Video',
  description: 'Access TikTok user profiles, videos, and content via the TikTok Display API.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tiktokReq('GET', '/v2/user/info/?fields=open_id,display_name,avatar_url', creds.access_token); if (r.error?.code !== 'ok') return { success: false, message: r.error?.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.data?.user?.display_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user_info: async (params, creds) => {
      const fields = params.fields || 'open_id,display_name,avatar_url,follower_count,following_count,likes_count';
      return tiktokReq('GET', `/v2/user/info/?fields=${encodeURIComponent(fields)}`, creds.access_token);
    },
    list_videos: async (params, creds) => {
      const fields = params.fields || 'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count';
      return tiktokReq('POST', `/v2/video/list/?fields=${encodeURIComponent(fields)}`, creds.access_token, { max_count: params.max_count || 20, ...(params.cursor && { cursor: params.cursor }) });
    },
    get_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const fields = params.fields || 'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,duration';
      return tiktokReq('POST', `/v2/video/query/?fields=${encodeURIComponent(fields)}`, creds.access_token, { filters: { video_ids: [params.video_id] } });
    },
    search_videos: async (params, creds) => {
      if (!params.keyword) throw new Error('keyword required');
      return tiktokReq('POST', '/v2/research/video/query/?fields=id,title,create_time,username,region_code,view_count,like_count,comment_count,share_count', creds.access_token, { query: { and: [{ operation: 'IN', field_name: 'keyword', field_values: [params.keyword] }] }, start_date: params.start_date || '20230101', end_date: params.end_date || new Date().toISOString().slice(0, 10).replace(/-/g, ''), max_count: params.max_count || 20 });
    },
    get_comments: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      return tiktokReq('POST', '/v2/research/video/comment/list/?fields=id,text,create_time,like_count', creds.access_token, { video_id: params.video_id, max_count: params.max_count || 20, ...(params.cursor && { cursor: params.cursor }) });
    },
    search_hashtag: async (params, creds) => {
      if (!params.hashtag_name) throw new Error('hashtag_name required');
      return tiktokReq('POST', '/v2/research/hashtag/query/', creds.access_token, { hashtag_name: params.hashtag_name, fields: params.fields || 'id,create_day,hashtag_name,hashtag_id,video_views,video_count' });
    },
    get_creator_info: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const fields = params.fields || 'display_name,bio_description,avatar_url,is_verified,follower_count,following_count,likes_count,video_count';
      return tiktokReq('POST', `/v2/research/user/info/?fields=${encodeURIComponent(fields)}`, creds.access_token, { username: params.username });
    },
    get_user_followers: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      return tiktokReq('POST', '/v2/research/user/followers/', creds.access_token, { username: params.username, max_count: params.max_count || 100, ...(params.cursor && { cursor: params.cursor }) });
    },
    get_user_following: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      return tiktokReq('POST', '/v2/research/user/following/', creds.access_token, { username: params.username, max_count: params.max_count || 100, ...(params.cursor && { cursor: params.cursor }) });
    },
    get_liked_videos: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const fields = params.fields || 'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count';
      return tiktokReq('POST', `/v2/research/user/liked_videos/?fields=${encodeURIComponent(fields)}`, creds.access_token, { username: params.username, max_count: params.max_count || 20, ...(params.cursor && { cursor: params.cursor }) });
    },
    get_pinned_videos: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const fields = params.fields || 'id,title,create_time,cover_image_url,share_url,view_count,like_count';
      return tiktokReq('POST', `/v2/research/user/pinned_videos/?fields=${encodeURIComponent(fields)}`, creds.access_token, { username: params.username });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
