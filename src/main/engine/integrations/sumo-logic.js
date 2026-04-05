/**
 * Sumo Logic Log Analytics API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function sumoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.access_id}:${creds.access_key}`).toString('base64');
  const host = creds.endpoint || 'api.us2.sumologic.com';
  const opts = { method, hostname: host, path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'sumo-logic',
  name: 'Sumo Logic',
  category: 'monitoring',
  icon: 'Database',
  description: 'Run log and metric queries, manage collectors, and get dashboards from Sumo Logic.',
  configFields: [
    { key: 'access_id', label: 'Access ID', type: 'text', required: true },
    { key: 'access_key', label: 'Access Key', type: 'password', required: true },
    { key: 'endpoint', label: 'API Endpoint (default: api.us2.sumologic.com)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_id || !creds.access_key) throw new Error('access_id and access_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sumoReq('GET', '/collectors?limit=1', null, creds); return { success: true, message: `Connected — ${r.collectors?.length ?? 0} collector(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_collectors: async (params, creds) => sumoReq('GET', `/collectors?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    get_collector: async (params, creds) => {
      if (!params.collector_id) throw new Error('collector_id required');
      return sumoReq('GET', `/collectors/${params.collector_id}`, null, creds);
    },
    create_search_job: async (params, creds) => {
      if (!params.query || !params.from || !params.to) throw new Error('query, from, and to required (ISO 8601)');
      return sumoReq('POST', '/search/jobs', { query: params.query, from: params.from, to: params.to, timeZone: params.timezone || 'UTC' }, creds);
    },
    get_search_job: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return sumoReq('GET', `/search/jobs/${params.job_id}`, null, creds);
    },
    get_search_messages: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return sumoReq('GET', `/search/jobs/${params.job_id}/messages?offset=${params.offset || 0}&limit=${params.limit || 100}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
