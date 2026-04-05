/**
 * Paylocity Payroll & HR API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getPaylocityToken(creds) {
  return _cache.get(`paylocity:${creds.client_id}`, async () => {
    const body = 'grant_type=client_credentials';
    const auth = Buffer.from(`${creds.client_id}:${creds.client_secret}`).toString('base64');
    const opts = { method: 'POST', hostname: 'api.paylocity.com', path: '/IdentityServer/connect/token', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    return { token: r.access_token, expiresAt: Date.now() + (r.expires_in - 60) * 1000 };
  });
}

async function paylocityReq(method, path, body, creds) {
  const token = await getPaylocityToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.paylocity.com', path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'paylocity',
  name: 'Paylocity',
  category: 'hr',
  icon: 'DollarSign',
  description: 'Access employees, payroll, time off, and benefits data from Paylocity.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'string', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    { key: 'company_id', label: 'Company ID', type: 'string', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret || !creds.company_id) throw new Error('client_id, client_secret, and company_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await paylocityReq('GET', `/companies/${creds.company_id}/employees/onboarding/new`, null, creds); return { success: true, message: 'Connected to Paylocity' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => paylocityReq('GET', `/companies/${creds.company_id}/employees?pagesize=${params.page_size || 25}&pagenumber=${params.page || 1}`, null, creds),
    get_employee: async (params, creds) => {
      if (!params.employee_id) throw new Error('employee_id required');
      return paylocityReq('GET', `/companies/${creds.company_id}/employees/${params.employee_id}`, null, creds);
    },
    get_employee_pay: async (params, creds) => {
      if (!params.employee_id) throw new Error('employee_id required');
      return paylocityReq('GET', `/companies/${creds.company_id}/employees/${params.employee_id}/pay`, null, creds);
    },
    list_time_off: async (params, creds) => {
      if (!params.employee_id) throw new Error('employee_id required');
      return paylocityReq('GET', `/companies/${creds.company_id}/employees/${params.employee_id}/timeOffs`, null, creds);
    },
    list_benefits: async (params, creds) => {
      if (!params.employee_id) throw new Error('employee_id required');
      return paylocityReq('GET', `/companies/${creds.company_id}/employees/${params.employee_id}/benefitSetUp`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
