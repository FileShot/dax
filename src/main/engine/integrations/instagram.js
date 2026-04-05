/**
 * Instagram Graph API Integration (Business/Creator accounts via Facebook Graph API)
 */
'use strict';
const https = require('https');

function igApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://graph.facebook.com/v19.0${path}`);
    url.searchParams.set('access_token', token);
    const opts = { method, hostname: url.hostname, path: `${url.pathname}${url.search}`, headers: { 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'instagram',
  name: 'Instagram',
  category: 'social',
  icon: 'Instagram',
  description: 'Access Instagram Business/Creator accounts via the Graph API.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
    { key: 'ig_user_id', label: 'Instagram Business Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.ig_user_id) throw new Error('Access token and IG user ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await igApi('GET', `/${creds.ig_user_id}?fields=id,name,username`, creds.access_token); return { success: !!r.id, message: r.id ? `Connected as @${r.username}` : `Error: ${r.error?.message || 'Unknown'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_profile: async (params, creds) => {
      const fields = params.fields || 'id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website';
      return igApi('GET', `/${creds.ig_user_id}?fields=${fields}`, creds.access_token);
    },
    get_media: async (params, creds) => {
      const limit = params.limit || 25;
      const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';
      return igApi('GET', `/${creds.ig_user_id}/media?fields=${fields}&limit=${limit}`, creds.access_token);
    },
    get_media_detail: async (params, creds) => {
      if (!params.media_id) throw new Error('media_id required');
      const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{id,media_type,media_url}';
      return igApi('GET', `/${params.media_id}?fields=${fields}`, creds.access_token);
    },
    get_insights: async (params, creds) => {
      const period = params.period || 'day';
      const metrics = params.metrics || 'impressions,reach,profile_views';
      return igApi('GET', `/${creds.ig_user_id}/insights?metric=${metrics}&period=${period}`, creds.access_token);
    },
    search_hashtag: async (params, creds) => {
      if (!params.hashtag) throw new Error('hashtag required');
      const tag = params.hashtag.replace('#', '');
      const search = await igApi('GET', `/ig_hashtag_search?q=${encodeURIComponent(tag)}&user_id=${creds.ig_user_id}`, creds.access_token);
      if (!search.data?.[0]?.id) return search;
      const hashtagId = search.data[0].id;
      const edge = params.edge || 'recent_media';
      const fields = 'id,caption,media_type,permalink,timestamp,like_count,comments_count';
      return igApi('GET', `/${hashtagId}/${edge}?user_id=${creds.ig_user_id}&fields=${fields}`, creds.access_token);
    },
    get_comments: async (params, creds) => {
      if (!params.media_id) throw new Error('media_id required');
      const fields = 'id,text,timestamp,username,like_count';
      return igApi('GET', `/${params.media_id}/comments?fields=${fields}&limit=${params.limit || 25}`, creds.access_token);
    },
    reply_comment: async (params, creds) => {
      if (!params.comment_id || !params.message) throw new Error('comment_id and message required');
      return igApi('POST', `/${params.comment_id}/replies?message=${encodeURIComponent(params.message)}`, creds.access_token);
    },
    get_media_insights: async (params, creds) => {
      if (!params.media_id) throw new Error('media_id required');
      const metrics = params.metrics || 'engagement,impressions,reach,saved';
      return igApi('GET', `/${params.media_id}/insights?metric=${metrics}`, creds.access_token);
    },
    get_story_media: async (params, creds) => {
      const fields = 'id,caption,media_type,media_url,timestamp';
      return igApi('GET', `/${creds.ig_user_id}/stories?fields=${fields}`, creds.access_token);
    },
    create_media_container: async (params, creds) => {
      if (!params.image_url && !params.video_url) throw new Error('image_url or video_url required');
      const qs = new URLSearchParams({ ...(params.image_url ? { image_url: params.image_url, media_type: 'IMAGE' } : { video_url: params.video_url, media_type: 'VIDEO' }), ...(params.caption && { caption: params.caption }) }).toString();
      return igApi('POST', `/${creds.ig_user_id}/media?${qs}`, creds.access_token);
    },
    publish_media: async (params, creds) => {
      if (!params.creation_id) throw new Error('creation_id required');
      return igApi('POST', `/${creds.ig_user_id}/media_publish?creation_id=${params.creation_id}`, creds.access_token);
    },
    get_tagged_media: async (params, creds) => {
      const fields = 'id,caption,media_type,permalink,timestamp';
      return igApi('GET', `/${creds.ig_user_id}/tags?fields=${fields}&limit=${params.limit || 25}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
