/**
 * DataSet (formerly Scalyr) Log Management API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function scalyrReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'app.scalyr.com', path, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'scalyr',
  name: 'DataSet (Scalyr)',
  category: 'monitoring',
  icon: 'Database',
  description: 'Query and search log data in DataSet (formerly Scalyr) with high-speed log analytics.',
  configFields: [{ key: 'read_token', label: 'Read API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.read_token) throw new Error('read_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await scalyrReq('POST', '/api/query', JSON.stringify({ token: creds.read_token, queryType: 'log', filter: '', startTime: '1h', maxCount: 1 }), creds);
      return { success: true, message: `Connected — status: ${r.status}` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query_logs: async (params, creds) => {
      const body = JSON.stringify({ token: creds.read_token, queryType: 'log', filter: params.filter || '', startTime: params.start_time || '1h', endTime: params.end_time || 'now', maxCount: params.max_count || 100, pageMode: params.page_mode || 'head' });
      return scalyrReq('POST', '/api/query', body, creds);
    },
    numeric_query: async (params, creds) => {
      if (!params.function) throw new Error('function required (e.g. count, mean)');
      const body = JSON.stringify({ token: creds.read_token, queryType: 'numeric', filter: params.filter || '', function: params.function, startTime: params.start_time || '1h', buckets: params.buckets || 1 });
      return scalyrReq('POST', '/api/numericQuery', body, creds);
    },
    facet_query: async (params, creds) => {
      if (!params.field) throw new Error('field required');
      const body = JSON.stringify({ token: creds.read_token, filter: params.filter || '', field: params.field, maxCount: params.max_count || 20, startTime: params.start_time || '1h' });
      return scalyrReq('POST', '/api/facetQuery', body, creds);
    },
    power_query: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const body = JSON.stringify({ token: creds.read_token, query: params.query, startTime: params.start_time || '1h', endTime: params.end_time || 'now' });
      return scalyrReq('POST', '/api/powerQuery', body, creds);
    },
    get_timeseries: async (params, creds) => {
      if (!params.queries) throw new Error('queries array required');
      const body = JSON.stringify({ token: creds.read_token, queries: params.queries, startTime: params.start_time || '1h', endTime: params.end_time || 'now', buckets: params.buckets || 60 });
      return scalyrReq('POST', '/api/timeseriesQuery', body, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
