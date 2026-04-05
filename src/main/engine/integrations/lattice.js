/**
 * Lattice Performance Management API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function latticeReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.latticehq.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'lattice',
  name: 'Lattice',
  category: 'hr',
  icon: 'BarChart',
  description: 'Access users, review cycles, goals, and 1-on-1s via Lattice performance management.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await latticeReq('GET', '/users?page=1&perPage=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} user(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_users: async (params, creds) => latticeReq('GET', `/users?page=${params.page || 1}&perPage=${params.per_page || 50}`, null, creds),
    get_user: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return latticeReq('GET', `/users/${params.id}`, null, creds);
    },
    list_review_cycles: async (params, creds) => latticeReq('GET', `/review-cycles?page=${params.page || 1}&perPage=${params.per_page || 20}`, null, creds),
    list_reviews: async (params, creds) => {
      if (!params.cycle_id) throw new Error('cycle_id required');
      return latticeReq('GET', `/review-cycles/${params.cycle_id}/reviews?page=${params.page || 1}&perPage=${params.per_page || 50}`, null, creds);
    },
    list_goals: async (params, creds) => latticeReq('GET', `/goals?page=${params.page || 1}&perPage=${params.per_page || 50}${params.user_id ? `&userId=${params.user_id}` : ''}`, null, creds),
    list_departments: async (params, creds) => latticeReq('GET', '/departments', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
