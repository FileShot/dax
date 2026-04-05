/**
 * Redash Analytics API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function redashReq(method, path, body, creds) {
  if (!creds.host) throw new Error('host required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: creds.host, path: `/api${path}`, headers: { 'Authorization': `Key ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'redash',
  name: 'Redash',
  category: 'data',
  icon: 'BarChart',
  description: 'Execute queries, access dashboards, and retrieve results with Redash.',
  configFields: [
    { key: 'host', label: 'Host', type: 'string', required: true, description: 'Redash instance hostname (e.g. redash.mycompany.com)' },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.host || !creds.api_key) throw new Error('host and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await redashReq('GET', '/queries?page_size=1&page=1', null, creds); return { success: true, message: `Connected — ${r.count ?? 0} query(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_queries: async (params, creds) => redashReq('GET', `/queries?page_size=${params.page_size || 25}&page=${params.page || 1}`, null, creds),
    get_query: async (params, creds) => {
      if (!params.query_id) throw new Error('query_id required');
      return redashReq('GET', `/queries/${params.query_id}`, null, creds);
    },
    execute_query: async (params, creds) => {
      if (!params.query_id) throw new Error('query_id required');
      return redashReq('POST', `/queries/${params.query_id}/results`, { parameters: params.parameters || {} }, creds);
    },
    get_query_results: async (params, creds) => {
      if (!params.query_result_id) throw new Error('query_result_id required');
      return redashReq('GET', `/query_results/${params.query_result_id}`, null, creds);
    },
    list_dashboards: async (params, creds) => redashReq('GET', `/dashboards?page_size=${params.page_size || 25}&page=${params.page || 1}`, null, creds),
    get_dashboard: async (params, creds) => {
      if (!params.slug) throw new Error('slug required');
      return redashReq('GET', `/dashboards/${params.slug}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
