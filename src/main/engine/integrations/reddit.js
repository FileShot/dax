/**
 * Reddit Integration
 */
'use strict';
const https = require('https');

function redditApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'oauth.reddit.com', path, headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'DaxAgent/1.0', 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'reddit',
  name: 'Reddit',
  category: 'social',
  icon: 'MessageCircle',
  description: 'Browse subreddits, search posts, and submit content via Reddit API.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'client_id', label: 'Client ID', type: 'text' },
    { key: 'client_secret', label: 'Client Secret', type: 'password' },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await redditApi('GET', '/api/v1/me', creds.access_token); return { success: r.status === 200, message: r.status === 200 ? `Authenticated as u/${r.data?.name}` : `Error: ${r.status}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_posts: async (params, creds) => {
      const sub = params.subreddit || 'all';
      const sort = params.sort || 'hot';
      const limit = params.limit || 25;
      const r = await redditApi('GET', `/r/${encodeURIComponent(sub)}/${sort}?limit=${limit}`, creds.access_token);
      return { subreddit: sub, posts: (r.data?.data?.children || []).map((c) => ({ id: c.data.id, title: c.data.title, author: c.data.author, score: c.data.score, url: c.data.url, selftext: c.data.selftext?.slice(0, 500), num_comments: c.data.num_comments, created_utc: c.data.created_utc })) };
    },
    get_comments: async (params, creds) => {
      if (!params.post_id) throw new Error('post_id required');
      const sub = params.subreddit || 'all';
      const r = await redditApi('GET', `/r/${sub}/comments/${params.post_id}?limit=${params.limit || 25}`, creds.access_token);
      const comments = Array.isArray(r.data) && r.data[1] ? (r.data[1].data?.children || []).map((c) => ({ id: c.data?.id, author: c.data?.author, body: c.data?.body?.slice(0, 500), score: c.data?.score })) : [];
      return { post_id: params.post_id, comments };
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(params.query);
      const limit = params.limit || 25;
      const sub = params.subreddit ? `/r/${encodeURIComponent(params.subreddit)}` : '';
      const r = await redditApi('GET', `${sub}/search?q=${q}&limit=${limit}&sort=${params.sort || 'relevance'}`, creds.access_token);
      return { query: params.query, results: (r.data?.data?.children || []).map((c) => ({ id: c.data.id, title: c.data.title, subreddit: c.data.subreddit, score: c.data.score, url: c.data.url })) };
    },
    submit_post: async (params, creds) => {
      if (!params.subreddit || !params.title) throw new Error('subreddit and title required');
      const body = new URLSearchParams({ sr: params.subreddit, title: params.title, kind: params.url ? 'link' : 'self', text: params.text || '', url: params.url || '', api_type: 'json' }).toString();
      const r = await redditApi('POST', '/api/submit', creds.access_token, body);
      return r.data;
    },
    get_subreddit: async (params, creds) => {
      if (!params.subreddit) throw new Error('subreddit required');
      const r = await redditApi('GET', `/r/${encodeURIComponent(params.subreddit)}/about`, creds.access_token);
      const d = r.data?.data || {};
      return { name: d.display_name, title: d.title, description: d.public_description, subscribers: d.subscribers, created_utc: d.created_utc };
    },
    vote: async (params, creds) => {
      if (!params.fullname) throw new Error('fullname (e.g. t3_xxxxx or t1_xxxxx) required');
      const dir = params.direction === 'up' ? 1 : params.direction === 'down' ? -1 : 0;
      const body = new URLSearchParams({ id: params.fullname, dir: String(dir), api_type: 'json' }).toString();
      const r = await redditApi('POST', '/api/vote', creds.access_token, body);
      return r.data;
    },
    save_post: async (params, creds) => {
      if (!params.fullname) throw new Error('fullname required');
      const endpoint = params.unsave ? '/api/unsave' : '/api/save';
      const body = new URLSearchParams({ id: params.fullname }).toString();
      const r = await redditApi('POST', endpoint, creds.access_token, body);
      return r.data;
    },
    get_user_profile: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const r = await redditApi('GET', `/user/${encodeURIComponent(params.username)}/about`, creds.access_token);
      const d = r.data?.data || {};
      return { name: d.name, comment_karma: d.comment_karma, link_karma: d.link_karma, created_utc: d.created_utc, is_gold: d.is_gold };
    },
    get_user_posts: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const type = params.type || 'submitted';
      const r = await redditApi('GET', `/user/${encodeURIComponent(params.username)}/${type}?limit=${params.limit || 25}`, creds.access_token);
      return { username: params.username, posts: (r.data?.data?.children || []).map((c) => ({ id: c.data.id, title: c.data.title || c.data.body?.slice(0, 100), score: c.data.score, subreddit: c.data.subreddit, created_utc: c.data.created_utc })) };
    },
    reply_comment: async (params, creds) => {
      if (!params.fullname || !params.text) throw new Error('fullname and text required');
      const body = new URLSearchParams({ thing_id: params.fullname, text: params.text, api_type: 'json' }).toString();
      const r = await redditApi('POST', '/api/comment', creds.access_token, body);
      return r.data;
    },
    get_inbox: async (params, creds) => {
      const filter = params.filter || 'unread';
      const r = await redditApi('GET', `/message/${filter}?limit=${params.limit || 25}`, creds.access_token);
      return { messages: (r.data?.data?.children || []).map((c) => ({ id: c.data.id, subject: c.data.subject, body: c.data.body, author: c.data.author, was_comment: c.data.was_comment, new: c.data.new })) };
    },
    mark_read: async (params, creds) => {
      if (!params.fullnames) throw new Error('fullnames (comma-separated) required');
      const body = new URLSearchParams({ id: Array.isArray(params.fullnames) ? params.fullnames.join(',') : params.fullnames }).toString();
      return redditApi('POST', '/api/read_message', creds.access_token, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
