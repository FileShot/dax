/**
 * Bluesky (AT Protocol) Integration
 */
'use strict';
const https = require('https');

function atpApi(method, host, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: host, path, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
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

const BSKY_HOST = 'bsky.social';

module.exports = {
  id: 'bluesky',
  name: 'Bluesky',
  category: 'social',
  icon: 'Cloud',
  description: 'Post, read feeds, and search on Bluesky via the AT Protocol.',
  configFields: [
    { key: 'identifier', label: 'Handle or Email', type: 'text', required: true },
    { key: 'app_password', label: 'App Password', type: 'password', required: true },
    { key: 'service', label: 'PDS Host (default: bsky.social)', type: 'text', required: false },
  ],
  _session: null,
  async _authenticate(creds) {
    const host = creds.service || BSKY_HOST;
    const r = await atpApi('POST', host, '/xrpc/com.atproto.server.createSession', null, { identifier: creds.identifier, password: creds.app_password });
    if (!r.accessJwt) throw new Error(`Auth failed: ${r.error || r.message || 'Unknown'}`);
    this._session = { host, accessJwt: r.accessJwt, refreshJwt: r.refreshJwt, did: r.did, handle: r.handle };
    return this._session;
  },
  async _ensureSession(creds) {
    if (!this._session) await this._authenticate(creds);
    return this._session;
  },
  async connect(creds) { if (!creds.identifier || !creds.app_password) throw new Error('Handle and app password required'); this.credentials = creds; await this._authenticate(creds); },
  async disconnect() { this._session = null; this.credentials = null; },
  async test(creds) {
    try { const s = await this._authenticate(creds); return { success: true, message: `Authenticated as @${s.handle}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_post: async function (params, creds, self) {
      const s = await self._ensureSession(creds);
      if (!params.text) throw new Error('text required');
      const record = { $type: 'app.bsky.feed.post', text: params.text, createdAt: new Date().toISOString() };
      // Parse facets for mentions and links (basic)
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const facets = [];
      let m;
      while ((m = urlRegex.exec(params.text)) !== null) {
        const byteStart = Buffer.byteLength(params.text.slice(0, m.index), 'utf8');
        const byteEnd = byteStart + Buffer.byteLength(m[0], 'utf8');
        facets.push({ index: { byteStart, byteEnd }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
      }
      if (facets.length) record.facets = facets;
      if (params.reply_to) {
        record.reply = { root: { uri: params.reply_to, cid: params.reply_cid || '' }, parent: { uri: params.reply_to, cid: params.reply_cid || '' } };
      }
      return atpApi('POST', s.host, '/xrpc/com.atproto.repo.createRecord', s.accessJwt, { repo: s.did, collection: 'app.bsky.feed.post', record });
    },
    get_feed: async function (params, creds, self) {
      const s = await self._ensureSession(creds);
      const limit = params.limit || 30;
      const algorithm = params.algorithm || '';
      let path = `/xrpc/app.bsky.feed.getTimeline?limit=${limit}`;
      if (algorithm) path += `&algorithm=${encodeURIComponent(algorithm)}`;
      return atpApi('GET', s.host, path, s.accessJwt);
    },
    get_profile: async function (params, creds, self) {
      const s = await self._ensureSession(creds);
      const actor = params.handle || s.handle;
      return atpApi('GET', s.host, `/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`, s.accessJwt);
    },
    search: async function (params, creds, self) {
      const s = await self._ensureSession(creds);
      if (!params.query) throw new Error('query required');
      const limit = params.limit || 25;
      return atpApi('GET', s.host, `/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(params.query)}&limit=${limit}`, s.accessJwt);
    },
    like: async function (params, creds, self) {
      const s = await self._ensureSession(creds);
      if (!params.uri || !params.cid) throw new Error('uri and cid required');
      return atpApi('POST', s.host, '/xrpc/com.atproto.repo.createRecord', s.accessJwt, { repo: s.did, collection: 'app.bsky.feed.like', record: { $type: 'app.bsky.feed.like', subject: { uri: params.uri, cid: params.cid }, createdAt: new Date().toISOString() } });
    },
    follow: async function (params, creds, self) {
      const s = await self._ensureSession(creds);
      if (!params.did) throw new Error('did required');
      return atpApi('POST', s.host, '/xrpc/com.atproto.repo.createRecord', s.accessJwt, { repo: s.did, collection: 'app.bsky.graph.follow', record: { $type: 'app.bsky.graph.follow', subject: params.did, createdAt: new Date().toISOString() } });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials, this); },
};
