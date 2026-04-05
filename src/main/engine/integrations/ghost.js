/**
 * Ghost CMS Integration
 */
'use strict';
const https = require('https');
const http = require('http');
const crypto = require('crypto');

function createGhostJwt(adminKey) {
  const [id, secret] = adminKey.split(':');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
  const sig = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function ghostApi(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `/ghost/api/admin${path}`, headers: { 'Authorization': `Ghost ${token}`, 'Content-Type': 'application/json' } };
    const req = mod.request(opts, (res) => {
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
  id: 'ghost',
  name: 'Ghost',
  category: 'cms',
  icon: 'Ghost',
  description: 'Manage posts, pages, and members in Ghost CMS.',
  configFields: [
    { key: 'site_url', label: 'Ghost Site URL', type: 'text', required: true },
    { key: 'admin_api_key', label: 'Admin API Key', type: 'password', required: true, placeholder: 'id:secret' },
  ],
  async connect(creds) { if (!creds.site_url || !creds.admin_api_key) throw new Error('Site URL and Admin API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const jwt = createGhostJwt(creds.admin_api_key); const r = await ghostApi('GET', creds.site_url, '/site/', jwt); return { success: !!r.site, message: r.site ? `Connected to ${r.site.title}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_posts: async (params, creds) => { const jwt = createGhostJwt(creds.admin_api_key); return ghostApi('GET', creds.site_url, `/posts/?limit=${params.limit || 15}&fields=id,title,slug,status,published_at`, jwt); },
    get_post: async (params, creds) => { if (!params.post_id) throw new Error('post_id required'); const jwt = createGhostJwt(creds.admin_api_key); return ghostApi('GET', creds.site_url, `/posts/${params.post_id}/`, jwt); },
    create_post: async (params, creds) => { if (!params.title) throw new Error('title required'); const jwt = createGhostJwt(creds.admin_api_key); return ghostApi('POST', creds.site_url, '/posts/', jwt, { posts: [{ title: params.title, html: params.html || '', status: params.status || 'draft' }] }); },
    list_members: async (params, creds) => { const jwt = createGhostJwt(creds.admin_api_key); return ghostApi('GET', creds.site_url, `/members/?limit=${params.limit || 15}`, jwt); },
    list_tags: async (params, creds) => { const jwt = createGhostJwt(creds.admin_api_key); return ghostApi('GET', creds.site_url, `/tags/?limit=${params.limit || 50}`, jwt); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
