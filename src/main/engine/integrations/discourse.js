/**
 * Discourse Community Forum Integration
 */
'use strict';
const https = require('https');
const http = require('http');
const url = require('url');

function discourseReq(method, siteUrl, path, apiKey, apiUsername, body) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(siteUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: parsed.hostname, port: parsed.port || (isHttps ? 443 : 80), path: `${parsed.pathname?.replace(/\/$/, '')}${path}`,
      headers: { 'Api-Key': apiKey, 'Api-Username': apiUsername, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
    const req = lib.request(opts, (res) => {
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
  id: 'discourse',
  name: 'Discourse',
  category: 'education',
  icon: 'MessageSquare',
  description: 'Interact with Discourse community forum topics, posts, and users.',
  configFields: [
    { key: 'site_url', label: 'Discourse URL', type: 'text', required: true, placeholder: 'https://forum.example.com' },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'api_username', label: 'API Username', type: 'text', required: true, placeholder: 'system' },
  ],
  async connect(creds) { if (!creds.site_url || !creds.api_key || !creds.api_username) throw new Error('Site URL, API key, and username required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await discourseReq('GET', creds.site_url, '/site.json', creds.api_key, creds.api_username); if (r.errors) return { success: false, message: r.errors[0] || 'Auth failed' }; return { success: true, message: `Connected to ${r.title || creds.site_url}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_topics: async (params, creds) => {
      const cat = params.category_slug ? `/c/${params.category_slug}.json` : '/latest.json';
      return discourseReq('GET', creds.site_url, `${cat}?page=${params.page || 0}`, creds.api_key, creds.api_username);
    },
    get_topic: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return discourseReq('GET', creds.site_url, `/t/${params.id}.json`, creds.api_key, creds.api_username);
    },
    create_topic: async (params, creds) => {
      if (!params.title || !params.raw) throw new Error('title and raw (body) required');
      return discourseReq('POST', creds.site_url, '/posts.json', creds.api_key, creds.api_username, { title: params.title, raw: params.raw, ...(params.category && { category: params.category }) });
    },
    get_category: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return discourseReq('GET', creds.site_url, `/c/${params.id}/show.json`, creds.api_key, creds.api_username);
    },
    get_user: async (params, creds) => {
      if (!params.username) throw new Error('username required');
      return discourseReq('GET', creds.site_url, `/users/${params.username}.json`, creds.api_key, creds.api_username);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
