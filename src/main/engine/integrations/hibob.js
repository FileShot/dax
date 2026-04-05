/**
 * HiBob HR API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bobReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.hibob.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.service_user_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'hibob',
  name: 'HiBob',
  category: 'hr',
  icon: 'Users',
  description: 'Access and manage employees, teams, and HR data via the HiBob API.',
  configFields: [{ key: 'service_user_token', label: 'Service User Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.service_user_token) throw new Error('service_user_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bobReq('GET', '/people?limit=1', null, creds); return { success: true, message: `Connected — ${r.employees?.length ?? 0} employee(s) found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => bobReq('GET', `/people?humanReadable=true&showInactive=${params.include_inactive || false}&limit=${params.limit || 50}`, null, creds),
    get_employee: async (params, creds) => {
      if (!params.identifier) throw new Error('identifier required (employee ID or email)');
      return bobReq('GET', `/people/${encodeURIComponent(params.identifier)}`, null, creds);
    },
    list_departments: async (params, creds) => bobReq('GET', '/company/named-lists/departments', null, creds),
    list_sites: async (params, creds) => bobReq('GET', '/company/named-lists/site', null, creds),
    get_today_report: async (params, creds) => bobReq('GET', '/people?humanReadable=true', null, creds),
    list_tasks: async (params, creds) => bobReq('GET', `/tasks?assignee=${params.assignee || ''}&status=${params.status || 'pending'}`, null, creds),
    list_time_off: async (params, creds) => {
      if (!params.from || !params.to) throw new Error('from and to dates required');
      return bobReq('GET', `/timeoff/requests?from=${params.from}&to=${params.to}&includeHourly=false&includePrivate=true`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
