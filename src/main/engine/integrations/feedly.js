/**
 * Feedly Integration
 */
'use strict';
const https = require('https');

function feedlyRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'cloud.feedly.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'feedly',
  name: 'Feedly',
  category: 'news',
  icon: 'Rss',
  description: 'Read feeds, manage subscriptions, and mark articles using the Feedly API.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
    { key: 'user_id', label: 'User ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.user_id) throw new Error('Access token and user ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await feedlyRequest('GET', `/v3/profile`, null, creds.access_token); return { success: !!r.id, message: r.errorMessage || `Connected — ${r.email || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_subscriptions: async (params, creds) => {
      return feedlyRequest('GET', '/v3/subscriptions', null, creds.access_token);
    },
    get_stream_contents: async (params, creds) => {
      if (!params.stream_id) throw new Error('stream_id required');
      const qs = new URLSearchParams({ streamId: params.stream_id, count: String(params.count || 20), ranked: params.ranked || 'newest', ...(params.continuation && { continuation: params.continuation }), ...(params.unread_only && { unreadOnly: String(params.unread_only) }) }).toString();
      return feedlyRequest('GET', `/v3/streams/contents?${qs}`, null, creds.access_token);
    },
    get_feed: async (params, creds) => {
      if (!params.feed_id) throw new Error('feed_id required');
      return feedlyRequest('GET', `/v3/feeds/${encodeURIComponent(params.feed_id)}`, null, creds.access_token);
    },
    mark_as_read: async (params, creds) => {
      if (!params.entry_ids && !params.feed_ids && !params.stream_ids) throw new Error('entry_ids, feed_ids, or stream_ids required');
      const body = { action: 'markAsRead', ...(params.entry_ids && { entryIds: params.entry_ids }), ...(params.feed_ids && { feedIds: params.feed_ids }), ...(params.stream_ids && { streamIds: params.stream_ids }) };
      return feedlyRequest('POST', '/v3/markers', body, creds.access_token);
    },
    search_feeds: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return feedlyRequest('GET', `/v3/search/feeds?query=${encodeURIComponent(params.query)}&count=${params.count || 20}`, null, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
