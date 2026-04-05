/**
 * 15Five Employee Engagement API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ffReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'my.15five.com', path: `/api/public/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: '15five',
  name: '15Five',
  category: 'hr',
  icon: 'BarChart',
  description: 'Manage users, check-ins, OKRs, and 1-on-1s via 15Five employee engagement.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ffReq('GET', '/users?limit=1', null, creds); return { success: true, message: `Connected — ${r.results?.length ?? 0} user(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_users: async (params, creds) => ffReq('GET', `/users?limit=${params.limit || 50}&offset=${params.offset || 0}`, null, creds),
    get_user: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return ffReq('GET', `/users/${params.id}`, null, creds);
    },
    list_check_ins: async (params, creds) => ffReq('GET', `/high-fives?limit=${params.limit || 20}${params.user_id ? `&user=${params.user_id}` : ''}`, null, creds),
    list_objectives: async (params, creds) => ffReq('GET', `/objectives?limit=${params.limit || 20}${params.user_id ? `&user=${params.user_id}` : ''}`, null, creds),
    list_one_on_ones: async (params, creds) => ffReq('GET', `/relationships?limit=${params.limit || 20}`, null, creds),
    list_groups: async (params, creds) => ffReq('GET', `/groups?limit=${params.limit || 50}`, null, creds),
    list_reviews: async (params, creds) => ffReq('GET', `/reviews?limit=${params.limit || 20}${params.user_id ? `&user=${params.user_id}` : ''}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
