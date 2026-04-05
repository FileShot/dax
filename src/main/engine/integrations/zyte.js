/**
 * Zyte (formerly Scrapinghub) Web Scraping API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function zyteReq(method, hostname, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname, path, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'zyte',
  name: 'Zyte',
  category: 'data',
  icon: 'Globe',
  description: 'Scrape the web, manage spiders, and retrieve jobs with Zyte (Scrapinghub).',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await zyteReq('GET', 'app.zyte.com', '/api/v1/projects', null, creds);
      return { success: true, message: `Connected — ${r.data?.length ?? 0} project(s)` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    scrape_url: async (params, creds) => {
      if (!params.url) throw new Error('url required');
      const body = { url: params.url, browserHtml: params.browser_html || false, httpResponseBody: params.http_response || true };
      return zyteReq('POST', 'api.zyte.com', '/v1/extract', body, creds);
    },
    list_projects: async (params, creds) => zyteReq('GET', 'app.zyte.com', `/api/v1/projects?page=${params.page || 1}`, null, creds),
    list_spiders: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return zyteReq('GET', 'app.zyte.com', `/api/v1/projects/${params.project_id}/spiders`, null, creds);
    },
    list_jobs: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return zyteReq('GET', 'storage.scrapinghub.com', `/api/jobs/list.json?project=${params.project_id}&count=${params.count || 20}&state=${params.state || 'finished'}`, null, creds);
    },
    get_job_items: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return zyteReq('GET', 'storage.scrapinghub.com', `/api/items.json/${params.job_id}?count=${params.count || 100}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
