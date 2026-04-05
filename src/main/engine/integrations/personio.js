/**
 * Personio HR API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getPersonioToken(creds) {
  return _cache.get(`personio:${creds.client_id}`, async () => {
    const body = JSON.stringify({ client_id: creds.client_id, client_secret: creds.client_secret });
    const opts = { method: 'POST', hostname: 'api.personio.de', path: '/v1/auth', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    if (!r.data?.token) throw new Error('Failed to obtain Personio token');
    return { token: r.data.token, expiresAt: Date.now() + 3600000 };
  });
}

async function personioReq(method, path, body, creds) {
  const token = await getPersonioToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.personio.de', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'personio',
  name: 'Personio',
  category: 'hr',
  icon: 'Users',
  description: 'Manage employees, attendance, and time-off records via Personio HR.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'string', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('client_id and client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await personioReq('GET', '/personnel/employees?limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} employee(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => personioReq('GET', `/personnel/employees?limit=${params.limit || 50}&offset=${params.offset || 0}`, null, creds),
    get_employee: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return personioReq('GET', `/personnel/employees/${params.id}`, null, creds);
    },
    list_attendance: async (params, creds) => {
      if (!params.start_date || !params.end_date) throw new Error('start_date and end_date required');
      return personioReq('GET', `/attendances/employees?start_date=${params.start_date}&end_date=${params.end_date}&limit=${params.limit || 50}`, null, creds);
    },
    list_time_offs: async (params, creds) => personioReq('GET', `/personnel/absences/types`, null, creds),
    list_time_off_requests: async (params, creds) => {
      return personioReq('GET', `/time-offs?start_date=${params.start_date || ''}&end_date=${params.end_date || ''}&limit=${params.limit || 50}`, null, creds);
    },
    get_company_info: async (params, creds) => personioReq('GET', '/company', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
