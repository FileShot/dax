/**
 * YouTube Integration — Data API v3
 */
'use strict';
const https = require('https');

function ytApi(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'www.googleapis.com', path: `/youtube/v3${path}${sep}key=${apiKey}`, headers: { 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'youtube',
  name: 'YouTube',
  category: 'social',
  icon: 'Youtube',
  description: 'Search videos, manage playlists, and read channel analytics via YouTube Data API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ytApi('/search?part=snippet&q=test&maxResults=1', creds.api_key); return { success: !r.error, message: r.error ? r.error.message : 'YouTube API connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_videos: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(params.query);
      const max = params.max_results || 10;
      const r = await ytApi(`/search?part=snippet&q=${q}&maxResults=${max}&type=video`, creds.api_key);
      return { query: params.query, results: (r.items || []).map((i) => ({ video_id: i.id?.videoId, title: i.snippet?.title, channel: i.snippet?.channelTitle, description: i.snippet?.description, published_at: i.snippet?.publishedAt, url: `https://youtube.com/watch?v=${i.id?.videoId}` })) };
    },
    get_video: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const r = await ytApi(`/videos?part=snippet,statistics,contentDetails&id=${params.video_id}`, creds.api_key);
      const v = r.items?.[0];
      if (!v) throw new Error('Video not found');
      return { video_id: v.id, title: v.snippet?.title, channel: v.snippet?.channelTitle, description: v.snippet?.description, views: v.statistics?.viewCount, likes: v.statistics?.likeCount, comments: v.statistics?.commentCount, duration: v.contentDetails?.duration, published_at: v.snippet?.publishedAt };
    },
    get_channel: async (params, creds) => {
      const part = 'snippet,statistics';
      const q = params.channel_id ? `&id=${params.channel_id}` : `&forUsername=${encodeURIComponent(params.username)}`;
      const r = await ytApi(`/channels?part=${part}${q}`, creds.api_key);
      const c = r.items?.[0];
      if (!c) throw new Error('Channel not found');
      return { channel_id: c.id, title: c.snippet?.title, description: c.snippet?.description, subscribers: c.statistics?.subscriberCount, videos: c.statistics?.videoCount, views: c.statistics?.viewCount };
    },
    get_channel_videos: async (params, creds) => {
      if (!params.channel_id) throw new Error('channel_id required');
      const max = params.max_results || 20;
      const r = await ytApi(`/search?part=snippet&channelId=${params.channel_id}&maxResults=${max}&type=video&order=${params.order || 'date'}`, creds.api_key);
      return { channel_id: params.channel_id, videos: (r.items || []).map((i) => ({ video_id: i.id?.videoId, title: i.snippet?.title, published_at: i.snippet?.publishedAt, url: `https://youtube.com/watch?v=${i.id?.videoId}` })) };
    },
    get_trending: async (params, creds) => {
      const region = params.region_code || 'US';
      const category = params.category_id || '0';
      const max = params.max_results || 20;
      const r = await ytApi(`/videos?part=snippet,statistics&chart=mostPopular&regionCode=${region}&videoCategoryId=${category}&maxResults=${max}`, creds.api_key);
      return { region, trending: (r.items || []).map((v) => ({ video_id: v.id, title: v.snippet?.title, channel: v.snippet?.channelTitle, views: v.statistics?.viewCount, likes: v.statistics?.likeCount })) };
    },
    get_comments: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const max = params.max_results || 20;
      const r = await ytApi(`/commentThreads?part=snippet&videoId=${params.video_id}&maxResults=${max}&order=${params.order || 'relevance'}`, creds.api_key);
      return { video_id: params.video_id, comments: (r.items || []).map((i) => ({ author: i.snippet?.topLevelComment?.snippet?.authorDisplayName, text: i.snippet?.topLevelComment?.snippet?.textDisplay, likes: i.snippet?.topLevelComment?.snippet?.likeCount, published_at: i.snippet?.topLevelComment?.snippet?.publishedAt })) };
    },
    get_playlist: async (params, creds) => {
      if (!params.playlist_id) throw new Error('playlist_id required');
      const max = params.max_results || 50;
      const r = await ytApi(`/playlistItems?part=snippet&playlistId=${params.playlist_id}&maxResults=${max}`, creds.api_key);
      return { playlist_id: params.playlist_id, items: (r.items || []).map((i) => ({ video_id: i.snippet?.resourceId?.videoId, title: i.snippet?.title, position: i.snippet?.position })) };
    },
    search_playlists: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(params.query);
      const max = params.max_results || 10;
      const r = await ytApi(`/search?part=snippet&q=${q}&maxResults=${max}&type=playlist`, creds.api_key);
      return { query: params.query, playlists: (r.items || []).map((i) => ({ playlist_id: i.id?.playlistId, title: i.snippet?.title, channel: i.snippet?.channelTitle, description: i.snippet?.description })) };
    },
    get_video_categories: async (params, creds) => {
      const region = params.region_code || 'US';
      const r = await ytApi(`/videoCategories?part=snippet&regionCode=${region}`, creds.api_key);
      return { region, categories: (r.items || []).map((c) => ({ id: c.id, title: c.snippet?.title })) };
    },
    search_channels: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(params.query);
      const max = params.max_results || 10;
      const r = await ytApi(`/search?part=snippet&q=${q}&maxResults=${max}&type=channel`, creds.api_key);
      return { query: params.query, channels: (r.items || []).map((i) => ({ channel_id: i.id?.channelId, title: i.snippet?.title, description: i.snippet?.description })) };
    },
    get_related_videos: async (params, creds) => {
      if (!params.video_id) throw new Error('video_id required');
      const max = params.max_results || 10;
      const r = await ytApi(`/search?part=snippet&relatedToVideoId=${params.video_id}&maxResults=${max}&type=video`, creds.api_key);
      return { video_id: params.video_id, related: (r.items || []).map((i) => ({ video_id: i.id?.videoId, title: i.snippet?.title, channel: i.snippet?.channelTitle, url: `https://youtube.com/watch?v=${i.id?.videoId}` })) };
    },
    get_channel_playlists: async (params, creds) => {
      if (!params.channel_id) throw new Error('channel_id required');
      const max = params.max_results || 20;
      const r = await ytApi(`/playlists?part=snippet,contentDetails&channelId=${params.channel_id}&maxResults=${max}`, creds.api_key);
      return { channel_id: params.channel_id, playlists: (r.items || []).map((p) => ({ playlist_id: p.id, title: p.snippet?.title, description: p.snippet?.description, item_count: p.contentDetails?.itemCount })) };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
