/**
 * Google Search Console API Integration
 */
'use strict';
const https = require('https');

function gscApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'www.googleapis.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'google-search-console',
  name: 'Google Search Console',
  category: 'seo',
  icon: 'Globe',
  description: 'Access search performance data and manage sitemaps via Google Search Console.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'site_url', label: 'Site URL', type: 'text', required: true, placeholder: 'https://example.com/' },
  ],
  async connect(creds) { if (!creds.access_token || !creds.site_url) throw new Error('Access token and site URL required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gscApi('GET', `/webmasters/v3/sites/${encodeURIComponent(creds.site_url)}`, creds.access_token); return { success: !!r.siteUrl, message: r.siteUrl ? `Connected to ${r.siteUrl}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_analytics: async (params, creds) => {
      const body = {
        startDate: params.start_date || new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
        endDate: params.end_date || new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        dimensions: params.dimensions || ['query'],
        rowLimit: params.limit || 25,
      };
      return gscApi('POST', `/webmasters/v3/sites/${encodeURIComponent(creds.site_url)}/searchAnalytics/query`, creds.access_token, body);
    },
    list_sitemaps: async (params, creds) => gscApi('GET', `/webmasters/v3/sites/${encodeURIComponent(creds.site_url)}/sitemaps`, creds.access_token),
    submit_sitemap: async (params, creds) => {
      if (!params.sitemap_url) throw new Error('sitemap_url required');
      return gscApi('PUT', `/webmasters/v3/sites/${encodeURIComponent(creds.site_url)}/sitemaps/${encodeURIComponent(params.sitemap_url)}`, creds.access_token);
    },
    list_sites: async (params, creds) => gscApi('GET', '/webmasters/v3/sites', creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
