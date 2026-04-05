/**
 * Inoreader Integration
 */
'use strict';
const https = require('https');

function inoreaderRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'www.inoreader.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'inoreader',
  name: 'Inoreader',
  category: 'news',
  icon: 'Rss',
  description: 'Manage RSS subscriptions and read articles via the Inoreader API.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await inoreaderRequest('GET', '/reader/api/0/user-info', null, creds.access_token); return { success: !!r.userId || !!r.userName, message: r.error || `Connected — ${r.userName || r.userId}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_subscriptions: async (params, creds) => {
      return inoreaderRequest('GET', '/reader/api/0/subscription/list?output=json', null, creds.access_token);
    },
    get_stream_contents: async (params, creds) => {
      if (!params.stream_id) throw new Error('stream_id required');
      const qs = new URLSearchParams({ n: String(params.count || 20), output: 'json', ...(params.continuation && { c: params.continuation }), ...(params.xt && { xt: params.xt }) }).toString();
      return inoreaderRequest('GET', `/reader/api/0/stream/contents/${encodeURIComponent(params.stream_id)}?${qs}`, null, creds.access_token);
    },
    mark_as_read: async (params, creds) => {
      if (!params.item_ids && !params.stream_id) throw new Error('item_ids or stream_id required');
      if (params.item_ids) {
        const qs = params.item_ids.map(id => `i=${encodeURIComponent(id)}`).join('&') + '&a=user/-/state/com.google/read';
        return inoreaderRequest('POST', `/reader/api/0/edit-tag?${qs}`, null, creds.access_token);
      }
      return inoreaderRequest('POST', `/reader/api/0/mark-all-as-read?s=${encodeURIComponent(params.stream_id)}&ts=${Date.now() * 1000}`, null, creds.access_token);
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ q: params.query, n: String(params.count || 20), output: 'json' }).toString();
      return inoreaderRequest('GET', `/reader/api/0/stream/contents/user/-/state/com.google/reading-list?${qs}`, null, creds.access_token);
    },
    get_unread_counts: async (params, creds) => {
      return inoreaderRequest('GET', '/reader/api/0/unread-count?output=json', null, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
