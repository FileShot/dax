/**
 * Pocket (Read It Later) Integration
 */
'use strict';
const https = require('https');

function pocketRequest(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = { method: 'POST', hostname: 'getpocket.com', path, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Accept': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'pocket',
  name: 'Pocket',
  category: 'news',
  icon: 'BookmarkCheck',
  description: 'Save, retrieve, and manage read-later items using the Pocket API.',
  configFields: [
    { key: 'consumer_key', label: 'Consumer Key', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.consumer_key || !creds.access_token) throw new Error('Consumer key and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pocketRequest('/v3/get', { consumer_key: creds.consumer_key, access_token: creds.access_token, count: 1 }); return { success: r.status === 1, message: r.error || (r.status === 1 ? 'Connected to Pocket' : 'Connection failed') }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    add_item: async (params, creds) => {
      if (!params.url) throw new Error('url required');
      return pocketRequest('/v3/add', { consumer_key: creds.consumer_key, access_token: creds.access_token, url: params.url, ...(params.title && { title: params.title }), ...(params.tags && { tags: params.tags }), ...(params.tweet_id && { tweet_id: params.tweet_id }) });
    },
    list_items: async (params, creds) => {
      return pocketRequest('/v3/get', { consumer_key: creds.consumer_key, access_token: creds.access_token, state: params.state || 'unread', count: params.count || 20, offset: params.offset || 0, sort: params.sort || 'newest', ...(params.search && { search: params.search }), ...(params.tag && { tag: params.tag }) });
    },
    archive_item: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return pocketRequest('/v3/send', { consumer_key: creds.consumer_key, access_token: creds.access_token, actions: [{ action: 'archive', item_id: params.item_id, time: Math.floor(Date.now() / 1000) }] });
    },
    delete_item: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return pocketRequest('/v3/send', { consumer_key: creds.consumer_key, access_token: creds.access_token, actions: [{ action: 'delete', item_id: params.item_id, time: Math.floor(Date.now() / 1000) }] });
    },
    add_tags: async (params, creds) => {
      if (!params.item_id || !params.tags) throw new Error('item_id and tags required');
      return pocketRequest('/v3/send', { consumer_key: creds.consumer_key, access_token: creds.access_token, actions: [{ action: 'tags_add', item_id: params.item_id, tags: Array.isArray(params.tags) ? params.tags.join(',') : params.tags, time: Math.floor(Date.now() / 1000) }] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
