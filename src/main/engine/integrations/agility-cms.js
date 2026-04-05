/**
 * Agility CMS Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function agilityReq(method, path, body, creds) {
  if (!creds.guid) throw new Error('guid required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const locale = creds.locale || 'en-us';
  const opts = { method, hostname: 'api.aglty.io', path: `/${creds.guid}/${locale}${path}`, headers: { 'APIKey': creds.api_key, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'agility-cms',
  name: 'Agility CMS',
  category: 'cms',
  icon: 'Layers',
  description: 'Fetch pages, content lists, and sitemaps from Agility CMS headless platform.',
  configFields: [
    { key: 'guid', label: 'Instance GUID', type: 'string', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'locale', label: 'Locale', type: 'string', required: false, description: 'Default: en-us' },
  ],
  async connect(creds) { if (!creds.guid || !creds.api_key) throw new Error('guid and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await agilityReq('GET', '/sitemap/flat?channelName=website&baseURL=/', null, creds); return { success: true, message: `Connected — ${Object.keys(r || {}).length} sitemap page(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_sitemap: async (params, creds) => agilityReq('GET', `/sitemap/flat?channelName=${params.channel || 'website'}&baseURL=${encodeURIComponent(params.base_url || '/')}`, null, creds),
    get_page: async (params, creds) => {
      if (!params.page_id) throw new Error('page_id required');
      return agilityReq('GET', `/page/${params.page_id}?contentLinkDepth=${params.link_depth || 2}`, null, creds);
    },
    get_content_list: async (params, creds) => {
      if (!params.ref_name) throw new Error('ref_name required');
      return agilityReq('GET', `/list/${params.ref_name}?take=${params.take || 20}&skip=${params.skip || 0}`, null, creds);
    },
    get_content_item: async (params, creds) => {
      if (!params.ref_name || !params.content_id) throw new Error('ref_name and content_id required');
      return agilityReq('GET', `/item/${params.ref_name}/${params.content_id}?contentLinkDepth=${params.link_depth || 2}`, null, creds);
    },
    list_galleries: async (params, creds) => agilityReq('GET', `/gallery?take=${params.take || 20}&skip=${params.skip || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
