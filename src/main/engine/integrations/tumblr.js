/**
 * Tumblr API v2 Integration
 */
'use strict';
const https = require('https');

function tumblrGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.tumblr.com', path: `/v2${path}${sep}api_key=${apiKey}`, headers: { 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function tumblrPost(path, oauthToken, bodyStr) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'POST', hostname: 'api.tumblr.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${oauthToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } };
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
  id: 'tumblr',
  name: 'Tumblr',
  category: 'social',
  icon: 'PenSquare',
  description: 'Access Tumblr blog posts, followers, and trending content via Tumblr API v2.',
  configFields: [
    { key: 'api_key', label: 'Consumer API Key', type: 'password', required: true },
    { key: 'oauth_token', label: 'OAuth Token (for posting)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('Consumer API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tumblrGet('/info', creds.api_key); if (r.meta?.status !== 200) return { success: false, message: r.meta?.msg || 'Auth failed' }; return { success: true, message: 'Connected to Tumblr API' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_blog_info: async (params, creds) => {
      if (!params.blog_identifier) throw new Error('blog_identifier required (e.g. username.tumblr.com)');
      return tumblrGet(`/blog/${params.blog_identifier}/info`, creds.api_key);
    },
    get_posts: async (params, creds) => {
      if (!params.blog_identifier) throw new Error('blog_identifier required');
      const qs = new URLSearchParams({ limit: String(params.limit || 20), offset: String(params.offset || 0), ...(params.type && { type: params.type }) }).toString();
      return tumblrGet(`/blog/${params.blog_identifier}/posts?${qs}`, creds.api_key);
    },
    get_tagged: async (params, creds) => {
      if (!params.tag) throw new Error('tag required');
      return tumblrGet(`/tagged?tag=${encodeURIComponent(params.tag)}&limit=${params.limit || 20}`, creds.api_key);
    },
    create_post: async (params, creds) => {
      if (!creds.oauth_token) throw new Error('oauth_token required for posting');
      if (!params.blog_identifier || !params.content) throw new Error('blog_identifier and content required');
      return tumblrPost(`/blog/${params.blog_identifier}/posts`, creds.oauth_token, JSON.stringify({ content: params.content, tags: params.tags || [] }));
    },
    get_followers: async (params, creds) => {
      if (!creds.oauth_token) throw new Error('oauth_token required');
      if (!params.blog_identifier) throw new Error('blog_identifier required');
      return tumblrPost(`/blog/${params.blog_identifier}/followers?limit=${params.limit || 20}`, creds.oauth_token, '{}');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
