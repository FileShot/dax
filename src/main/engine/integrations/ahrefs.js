/**
 * Ahrefs SEO API Integration
 */
'use strict';
const https = require('https');

function ahrefsApi(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.ahrefs.com', path: `/v3${path}${path.includes('?') ? '&' : '?'}output=json`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } };
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
  id: 'ahrefs',
  name: 'Ahrefs',
  category: 'seo',
  icon: 'TrendingUp',
  description: 'Access SEO data including backlinks, keywords, and domain ratings from Ahrefs.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ahrefsApi('/subscription-info', creds.api_token); return { success: !!r.usage || !r.error, message: r.usage ? 'Connected to Ahrefs' : 'Auth check OK' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_domain_rating: async (params, creds) => {
      if (!params.target) throw new Error('target domain required');
      return ahrefsApi(`/site-explorer/domain-rating?target=${encodeURIComponent(params.target)}`, creds.api_token);
    },
    get_backlinks: async (params, creds) => {
      if (!params.target) throw new Error('target URL or domain required');
      return ahrefsApi(`/site-explorer/all-backlinks?target=${encodeURIComponent(params.target)}&limit=${params.limit || 20}&mode=${params.mode || 'domain'}`, creds.api_token);
    },
    get_organic_keywords: async (params, creds) => {
      if (!params.target) throw new Error('target domain required');
      return ahrefsApi(`/site-explorer/organic-keywords?target=${encodeURIComponent(params.target)}&limit=${params.limit || 20}&country=${params.country || 'us'}`, creds.api_token);
    },
    get_top_pages: async (params, creds) => {
      if (!params.target) throw new Error('target domain required');
      return ahrefsApi(`/site-explorer/top-pages?target=${encodeURIComponent(params.target)}&limit=${params.limit || 20}&country=${params.country || 'us'}`, creds.api_token);
    },
    get_referring_domains: async (params, creds) => {
      if (!params.target) throw new Error('target required');
      return ahrefsApi(`/site-explorer/refdomains?target=${encodeURIComponent(params.target)}&limit=${params.limit || 20}&mode=${params.mode || 'domain'}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
