/**
 * Factorial HR API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function facReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.factorialhr.com', path: `/api/2024-01${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'factorial',
  name: 'Factorial',
  category: 'hr',
  icon: 'Users',
  description: 'Manage employees, leaves, attendance, and payroll with Factorial HR.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await facReq('GET', '/employees?only_active=true&fields[]=full_name&page=1&per_page=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} employee(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => facReq('GET', `/employees?only_active=${params.only_active !== false}&page=${params.page || 1}&per_page=${params.per_page || 50}`, null, creds),
    get_employee: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return facReq('GET', `/employees/${params.id}`, null, creds);
    },
    list_leaves: async (params, creds) => facReq('GET', `/time_off/leaves?page=${params.page || 1}&per_page=${params.per_page || 50}${params.employee_id ? `&employee_id=${params.employee_id}` : ''}`, null, creds),
    list_leave_types: async (params, creds) => facReq('GET', '/time_off/leave_types', null, creds),
    list_shifts: async (params, creds) => facReq('GET', `/attendance/shifts?page=${params.page || 1}&per_page=${params.per_page || 50}${params.employee_id ? `&employee_id=${params.employee_id}` : ''}`, null, creds),
    list_payslips: async (params, creds) => facReq('GET', `/payroll/payslips?page=${params.page || 1}&per_page=${params.per_page || 50}`, null, creds),
    get_company: async (params, creds) => facReq('GET', '/companies', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
