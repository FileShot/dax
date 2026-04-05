/**
 * Keka HR API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getKekaToken(creds) {
  return _cache.get(`keka:${creds.client_id}`, async () => {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.client_id, client_secret: creds.client_secret, scope: 'kekaapi' }).toString();
    const opts = { method: 'POST', hostname: `${creds.org}.keka.com`, path: '/identity/connect/token', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    return { token: r.access_token, expiresAt: Date.now() + (r.expires_in - 60) * 1000 };
  });
}

async function kekaReq(method, path, body, creds) {
  const token = await getKekaToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: `${creds.org}.keka.com`, path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'keka',
  name: 'Keka',
  category: 'hr',
  icon: 'Users',
  description: 'Manage employees, attendance, leaves, and payroll data via Keka HR.',
  configFields: [
    { key: 'org', label: 'Organization Subdomain', type: 'string', required: true },
    { key: 'client_id', label: 'Client ID', type: 'string', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.org || !creds.client_id || !creds.client_secret) throw new Error('org, client_id, and client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await kekaReq('GET', '/hris/employees?count=1&skip=0', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} employee(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => kekaReq('GET', `/hris/employees?count=${params.count || 50}&skip=${params.skip || 0}`, null, creds),
    get_employee: async (params, creds) => {
      if (!params.identifier) throw new Error('identifier required (employeeNumber or id)');
      return kekaReq('GET', `/hris/employees/${params.identifier}`, null, creds);
    },
    list_attendance: async (params, creds) => {
      if (!params.from || !params.to) throw new Error('from and to required');
      return kekaReq('GET', `/psa/attendance?from=${params.from}&to=${params.to}&count=${params.count || 50}&skip=${params.skip || 0}`, null, creds);
    },
    list_leave_requests: async (params, creds) => kekaReq('GET', `/hris/leaves?count=${params.count || 50}&skip=${params.skip || 0}`, null, creds),
    list_leave_types: async (params, creds) => kekaReq('GET', '/hris/leavetypes', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
