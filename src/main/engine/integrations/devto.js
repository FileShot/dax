/**
 * DEV.to (Forem) API Integration
 */
'use strict';
const https = require('https');

function devtoApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'dev.to', path: `/api${path}`, headers: { 'api-key': apiKey, 'Content-Type': 'application/json' } };
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

module.exports = {
  id: 'devto',
  name: 'DEV.to',
  category: 'cms',
  icon: 'Code',
  description: 'Publish and manage articles on DEV.to (Forem).',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await devtoApi('GET', '/users/me', creds.api_key); return { success: !!r.id, message: r.id ? `Connected as ${r.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_articles: async (params, creds) => devtoApi('GET', `/articles/me?per_page=${params.limit || 20}&page=${params.page || 1}`, creds.api_key),
    get_article: async (params, creds) => { if (!params.article_id) throw new Error('article_id required'); return devtoApi('GET', `/articles/${params.article_id}`, creds.api_key); },
    create_article: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return devtoApi('POST', '/articles', creds.api_key, { article: { title: params.title, body_markdown: params.body || '', published: params.published || false, tags: params.tags || [] } });
    },
    update_article: async (params, creds) => {
      if (!params.article_id) throw new Error('article_id required');
      const body = {};
      if (params.title) body.title = params.title;
      if (params.body) body.body_markdown = params.body;
      if (params.published !== undefined) body.published = params.published;
      if (params.tags) body.tags = params.tags;
      return devtoApi('PUT', `/articles/${params.article_id}`, creds.api_key, { article: body });
    },
    list_comments: async (params, creds) => { if (!params.article_id) throw new Error('article_id required'); return devtoApi('GET', `/comments?a_id=${params.article_id}`, creds.api_key); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
