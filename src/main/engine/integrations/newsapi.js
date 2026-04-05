/**
 * News API Integration
 */
'use strict';
const https = require('https');

function newsapiRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'newsapi.org', path, headers: { 'X-Api-Key': apiKey } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'newsapi',
  name: 'NewsAPI',
  category: 'news',
  icon: 'Newspaper',
  description: 'Fetch top headlines and search news articles from thousands of sources with NewsAPI.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await newsapiRequest('/v2/top-headlines?country=us&pageSize=1', creds.api_key); return { success: r.status === 'ok', message: r.message || r.status || 'Connected to NewsAPI' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    top_headlines: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.country && { country: params.country }), ...(params.category && { category: params.category }), ...(params.sources && { sources: params.sources }), ...(params.q && { q: params.q }), ...(params.page_size && { pageSize: String(params.page_size) }), ...(params.page && { page: String(params.page) }) }).toString();
      return newsapiRequest(`/v2/top-headlines${qs ? `?${qs}` : ''}`, creds.api_key);
    },
    search_everything: async (params, creds) => {
      if (!params.q && !params.sources && !params.domains) throw new Error('q, sources, or domains required');
      const qs = new URLSearchParams({ ...(params.q && { q: params.q }), ...(params.sources && { sources: params.sources }), ...(params.domains && { domains: params.domains }), ...(params.from && { from: params.from }), ...(params.to && { to: params.to }), ...(params.language && { language: params.language }), ...(params.sort_by && { sortBy: params.sort_by }), ...(params.page_size && { pageSize: String(params.page_size) }), ...(params.page && { page: String(params.page) }) }).toString();
      return newsapiRequest(`/v2/everything?${qs}`, creds.api_key);
    },
    get_sources: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.category && { category: params.category }), ...(params.language && { language: params.language }), ...(params.country && { country: params.country }) }).toString();
      return newsapiRequest(`/v2/top-headlines/sources${qs ? `?${qs}` : ''}`, creds.api_key);
    },
    search_by_category: async (params, creds) => {
      if (!params.category) throw new Error('category required');
      const qs = new URLSearchParams({ category: params.category, country: params.country || 'us', pageSize: String(params.page_size || 20) }).toString();
      return newsapiRequest(`/v2/top-headlines?${qs}`, creds.api_key);
    },
    search_by_source: async (params, creds) => {
      if (!params.source_id) throw new Error('source_id required');
      const qs = new URLSearchParams({ sources: params.source_id, pageSize: String(params.page_size || 20) }).toString();
      return newsapiRequest(`/v2/everything?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
