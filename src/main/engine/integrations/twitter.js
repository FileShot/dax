/**
 * Twitter/X Integration — API v2
 */
'use strict';
const https = require('https');

function twitterApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.twitter.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'twitter',
  name: 'Twitter / X',
  category: 'social',
  icon: 'Twitter',
  description: 'Post tweets, search, and read timelines via the X API v2.',
  configFields: [
    { key: 'bearer_token', label: 'Bearer Token', type: 'password', required: true },
    { key: 'api_key', label: 'API Key (for posting)', type: 'password' },
    { key: 'api_secret', label: 'API Secret', type: 'password' },
    { key: 'access_token', label: 'Access Token', type: 'password' },
    { key: 'access_secret', label: 'Access Token Secret', type: 'password' },
  ],
  async connect(creds) { if (!creds.bearer_token) throw new Error('Bearer token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await twitterApi('GET', '/2/users/me', creds.bearer_token); return { success: r.status === 200, message: r.status === 200 ? `Authenticated as @${r.data?.data?.username}` : `Error: ${JSON.stringify(r.data)}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    post_tweet: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const body = { text: params.text };
      if (params.reply_to) body.reply = { in_reply_to_tweet_id: params.reply_to };
      const r = await twitterApi('POST', '/2/tweets', creds.bearer_token, body);
      if (r.status !== 201) throw new Error(`Tweet failed: ${JSON.stringify(r.data)}`);
      return r.data;
    },
    delete_tweet: async (params, creds) => {
      if (!params.tweet_id) throw new Error('tweet_id required');
      const r = await twitterApi('DELETE', `/2/tweets/${params.tweet_id}`, creds.bearer_token);
      return r.data;
    },
    get_tweet: async (params, creds) => {
      if (!params.tweet_id) throw new Error('tweet_id required');
      const r = await twitterApi('GET', `/2/tweets/${params.tweet_id}?tweet.fields=created_at,author_id,public_metrics,entities,referenced_tweets`, creds.bearer_token);
      return r.data;
    },
    search_tweets: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(params.query);
      const max = params.max_results || 10;
      const r = await twitterApi('GET', `/2/tweets/search/recent?query=${q}&max_results=${max}&tweet.fields=created_at,author_id,public_metrics`, creds.bearer_token);
      return r.data;
    },
    get_user: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      const r = await twitterApi('GET', `/2/users/by/username/${encodeURIComponent(params.username)}?user.fields=description,public_metrics,created_at,verified`, creds.bearer_token);
      return r.data;
    },
    get_user_by_id: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const r = await twitterApi('GET', `/2/users/${params.user_id}?user.fields=description,public_metrics,created_at,verified`, creds.bearer_token);
      return r.data;
    },
    get_timeline: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const max = params.max_results || 10;
      const r = await twitterApi('GET', `/2/users/${params.user_id}/tweets?max_results=${max}&tweet.fields=created_at,public_metrics`, creds.bearer_token);
      return r.data;
    },
    get_user_mentions: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const max = params.max_results || 10;
      const r = await twitterApi('GET', `/2/users/${params.user_id}/mentions?max_results=${max}&tweet.fields=created_at,public_metrics,author_id`, creds.bearer_token);
      return r.data;
    },
    like_tweet: async (params, creds) => {
      if (!params.tweet_id) throw new Error('tweet_id required');
      const me = await twitterApi('GET', '/2/users/me', creds.bearer_token);
      const userId = me.data?.data?.id;
      const r = await twitterApi('POST', `/2/users/${userId}/likes`, creds.bearer_token, { tweet_id: params.tweet_id });
      return r.data;
    },
    unlike_tweet: async (params, creds) => {
      if (!params.tweet_id) throw new Error('tweet_id required');
      const me = await twitterApi('GET', '/2/users/me', creds.bearer_token);
      const userId = me.data?.data?.id;
      const r = await twitterApi('DELETE', `/2/users/${userId}/likes/${params.tweet_id}`, creds.bearer_token);
      return r.data;
    },
    retweet: async (params, creds) => {
      if (!params.tweet_id) throw new Error('tweet_id required');
      const me = await twitterApi('GET', '/2/users/me', creds.bearer_token);
      const userId = me.data?.data?.id;
      const r = await twitterApi('POST', `/2/users/${userId}/retweets`, creds.bearer_token, { tweet_id: params.tweet_id });
      return r.data;
    },
    get_followers: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const max = params.max_results || 100;
      const r = await twitterApi('GET', `/2/users/${params.user_id}/followers?max_results=${max}&user.fields=description,public_metrics`, creds.bearer_token);
      return r.data;
    },
    get_following: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const max = params.max_results || 100;
      const r = await twitterApi('GET', `/2/users/${params.user_id}/following?max_results=${max}&user.fields=description,public_metrics`, creds.bearer_token);
      return r.data;
    },
    get_bookmarks: async (_params, creds) => {
      const me = await twitterApi('GET', '/2/users/me', creds.bearer_token);
      const userId = me.data?.data?.id;
      const r = await twitterApi('GET', `/2/users/${userId}/bookmarks?tweet.fields=created_at,public_metrics,author_id`, creds.bearer_token);
      return r.data;
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
