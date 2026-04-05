/**
 * Document360 API Integration
 */
'use strict';
const https = require('https');

function d360Api(method, path, apiToken, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'apihub.document360.io', path: `/v2${path}`, headers: { 'api_token': apiToken, 'Content-Type': 'application/json' } };
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
  id: 'document360',
  name: 'Document360',
  category: 'documentation',
  icon: 'FileStack',
  description: 'Manage knowledge bases and documentation with Document360.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await d360Api('GET', '/projects', creds.api_token); return { success: Array.isArray(r.data), message: `${(r.data || []).length} project(s) found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => d360Api('GET', '/projects', creds.api_token),
    list_categories: async (params, creds) => {
      if (!params.project_version_id) throw new Error('project_version_id required');
      return d360Api('GET', `/categories?project_version_id=${params.project_version_id}`, creds.api_token);
    },
    get_article: async (params, creds) => { if (!params.article_id) throw new Error('article_id required'); return d360Api('GET', `/articles/${params.article_id}`, creds.api_token); },
    search_articles: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, project_version_id: params.project_version_id || '' });
      return d360Api('GET', `/search?${qs}`, creds.api_token);
    },
    create_article: async (params, creds) => {
      if (!params.title || !params.project_version_id) throw new Error('title and project_version_id required');
      return d360Api('POST', '/articles', creds.api_token, { title: params.title, content: params.content || '', project_version_id: params.project_version_id, category_id: params.category_id });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
