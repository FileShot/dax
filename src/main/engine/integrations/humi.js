/**
 * Humi HR API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function humiReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'app.humi.ca', path: `/api${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'humi',
  name: 'Humi',
  category: 'hr',
  icon: 'Users',
  description: 'Manage employees, time off, benefits, and company info with Humi HR (Canada).',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await humiReq('GET', '/v0/employees?page=1&per_page=1', null, creds); return { success: true, message: `Connected — ${r.meta?.total ?? 0} employee(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => humiReq('GET', `/v0/employees?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    get_employee: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return humiReq('GET', `/v0/employees/${params.id}`, null, creds);
    },
    list_time_off: async (params, creds) => humiReq('GET', `/v0/time-off?page=${params.page || 1}&per_page=${params.per_page || 25}${params.employee_id ? `&employee_id=${params.employee_id}` : ''}`, null, creds),
    list_benefits: async (params, creds) => humiReq('GET', `/v0/benefits?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    get_company: async (params, creds) => humiReq('GET', '/v0/company', null, creds),
    list_departments: async (params, creds) => humiReq('GET', '/v0/departments', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
