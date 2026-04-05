/**
 * ButterCMS Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function butterReq(path, creds) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.buttercms.com', path: `/v2${path}${sep}auth_token=${creds.api_key}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'buttercms',
  name: 'ButterCMS',
  category: 'cms',
  icon: 'FileText',
  description: 'Fetch blog posts, pages, and content collections from ButterCMS.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await butterReq('/posts/?page=1&page_size=1', creds); return { success: true, message: `Connected — ${r.meta?.count ?? 0} post(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_posts: async (params, creds) => butterReq(`/posts/?page=${params.page || 1}&page_size=${params.page_size || 20}${params.tag ? `&tag=${params.tag}` : ''}${params.category ? `&category=${params.category}` : ''}`, creds),
    get_post: async (params, creds) => {
      if (!params.slug) throw new Error('slug required');
      return butterReq(`/posts/${params.slug}/`, creds);
    },
    list_pages: async (params, creds) => {
      if (!params.page_type) throw new Error('page_type required');
      return butterReq(`/pages/${params.page_type}/?page=${params.page || 1}&page_size=${params.page_size || 20}`, creds);
    },
    get_page: async (params, creds) => {
      if (!params.page_type || !params.slug) throw new Error('page_type and slug required');
      return butterReq(`/pages/${params.page_type}/${params.slug}/`, creds);
    },
    list_content_fields: async (params, creds) => {
      if (!params.keys) throw new Error('keys required (comma-separated field keys)');
      const keysParam = params.keys.split(',').map(k => `keys[]=${k.trim()}`).join('&');
      return butterReq(`/content/?${keysParam}`, creds);
    },
    list_categories: async (params, creds) => butterReq('/categories/', creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
