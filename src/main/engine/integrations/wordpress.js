/**
 * WordPress REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function wpApi(method, baseUrl, path, creds, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const auth = Buffer.from(`${creds.username}:${creds.app_password}`).toString('base64');
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `${url.pathname.replace(/\/$/, '')}/wp-json/wp/v2${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'wordpress',
  name: 'WordPress',
  category: 'cms',
  icon: 'FileText',
  description: 'Manage WordPress posts, pages, and media via REST API.',
  configFields: [
    { key: 'site_url', label: 'Site URL', type: 'text', required: true, placeholder: 'https://yoursite.com' },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'app_password', label: 'Application Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.site_url || !creds.username || !creds.app_password) throw new Error('Site URL, username, and app password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wpApi('GET', creds.site_url, '/users/me', creds); return { success: !!r.id, message: r.id ? `Connected as ${r.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_posts: async (params, creds) => wpApi('GET', creds.site_url, `/posts?per_page=${params.limit || 10}&status=${params.status || 'publish'}`, creds),
    get_post: async (params, creds) => { if (!params.post_id) throw new Error('post_id required'); return wpApi('GET', creds.site_url, `/posts/${params.post_id}`, creds); },
    create_post: async (params, creds) => { if (!params.title) throw new Error('title required'); return wpApi('POST', creds.site_url, '/posts', creds, { title: params.title, content: params.content || '', status: params.status || 'draft' }); },
    update_post: async (params, creds) => { if (!params.post_id) throw new Error('post_id required'); return wpApi('PUT', creds.site_url, `/posts/${params.post_id}`, creds, { title: params.title, content: params.content, status: params.status }); },
    delete_post: async (params, creds) => { if (!params.post_id) throw new Error('post_id required'); return wpApi('DELETE', creds.site_url, `/posts/${params.post_id}?force=${params.force || false}`, creds); },
    list_pages: async (params, creds) => wpApi('GET', creds.site_url, `/pages?per_page=${params.limit || 10}`, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
