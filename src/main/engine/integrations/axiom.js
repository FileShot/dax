/**
 * Axiom Log Analytics API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function axiomReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.axiom.co', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'axiom',
  name: 'Axiom',
  category: 'monitoring',
  icon: 'BarChart2',
  description: 'Ingest, query, and stream log data at scale with Axiom serverless observability.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await axiomReq('GET', '/datasets', null, creds); return { success: true, message: `${(r || []).length} dataset(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_datasets: async (params, creds) => axiomReq('GET', '/datasets', null, creds),
    get_dataset: async (params, creds) => {
      if (!params.dataset) throw new Error('dataset name required');
      return axiomReq('GET', `/datasets/${params.dataset}`, null, creds);
    },
    query: async (params, creds) => {
      if (!params.dataset || !params.apl) throw new Error('dataset and apl query required');
      return axiomReq('POST', `/datasets/${params.dataset}/query`, { apl: params.apl, startTime: params.start_time, endTime: params.end_time }, creds);
    },
    ingest: async (params, creds) => {
      if (!params.dataset || !params.events) throw new Error('dataset and events array required');
      return axiomReq('POST', `/datasets/${params.dataset}/ingest`, params.events, creds);
    },
    get_fields: async (params, creds) => {
      if (!params.dataset) throw new Error('dataset required');
      return axiomReq('GET', `/datasets/${params.dataset}/fields`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
