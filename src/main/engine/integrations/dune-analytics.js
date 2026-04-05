/**
 * Dune Analytics API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function duneReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.dune.com', path, headers: { 'X-Dune-API-Key': creds.api_key, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'dune-analytics',
  name: 'Dune Analytics',
  category: 'blockchain',
  icon: 'PieChart',
  description: 'Execute and fetch results from Dune Analytics blockchain data queries.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await duneReq('GET', '/api/v1/query/1/results', null, creds); return { success: true, message: 'Dune API connected' }; }
    catch (e) { if (e.message.includes('404') || e.message.includes('403')) return { success: true, message: 'Dune API key valid' }; return { success: false, message: e.message }; }
  },
  actions: {
    execute_query: async (params, creds) => {
      if (!params.query_id) throw new Error('query_id required');
      return duneReq('POST', `/api/v1/query/${params.query_id}/execute`, { query_parameters: params.query_parameters || {}, performance: params.performance || 'medium' }, creds);
    },
    get_execution_status: async (params, creds) => {
      if (!params.execution_id) throw new Error('execution_id required');
      return duneReq('GET', `/api/v1/execution/${params.execution_id}/status`, null, creds);
    },
    get_results: async (params, creds) => {
      if (!params.execution_id) throw new Error('execution_id required');
      const qs = params.limit ? `?limit=${params.limit}` : '';
      return duneReq('GET', `/api/v1/execution/${params.execution_id}/results${qs}`, null, creds);
    },
    get_latest_results: async (params, creds) => {
      if (!params.query_id) throw new Error('query_id required');
      const qs = params.limit ? `?limit=${params.limit}` : '';
      return duneReq('GET', `/api/v1/query/${params.query_id}/results${qs}`, null, creds);
    },
    cancel_execution: async (params, creds) => {
      if (!params.execution_id) throw new Error('execution_id required');
      return duneReq('POST', `/api/v1/execution/${params.execution_id}/cancel`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
