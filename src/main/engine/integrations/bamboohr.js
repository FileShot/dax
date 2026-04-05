/**
 * BambooHR Human Resources API Integration
 */
'use strict';
const https = require('https');

function bambooRequest(method, path, body, apiKey, subdomain) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:x`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: `api.bamboohr.com`, path: `/api/gateway.php/${subdomain}/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'bamboohr',
  name: 'BambooHR',
  category: 'hr',
  icon: 'Users',
  description: 'Manage employees, time-off, and HR data with BambooHR.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'subdomain', label: 'Company Subdomain', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.subdomain) throw new Error('API key and subdomain required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bambooRequest('GET', '/employees/directory', null, creds.api_key, creds.subdomain); return { success: !!r.employees, message: r.error || `Connected — ${r.employees?.length || 0} employees` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => {
      return bambooRequest('GET', '/employees/directory', null, creds.api_key, creds.subdomain);
    },
    get_employee: async (params, creds) => {
      if (!params.employee_id) throw new Error('employee_id required');
      const fields = params.fields || 'id,firstName,lastName,jobTitle,department,workEmail,mobilePhone,workPhone';
      return bambooRequest('GET', `/employees/${params.employee_id}?fields=${encodeURIComponent(fields)}`, null, creds.api_key, creds.subdomain);
    },
    get_time_off_requests: async (params, creds) => {
      const qs = new URLSearchParams({ start: params.start || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), end: params.end || new Date().toISOString().slice(0, 10), ...(params.employee_id && { employeeId: String(params.employee_id) }) }).toString();
      return bambooRequest('GET', `/time_off/requests/?${qs}`, null, creds.api_key, creds.subdomain);
    },
    get_who_is_out: async (params, creds) => {
      const qs = `?start=${params.start || new Date().toISOString().slice(0, 10)}&end=${params.end || new Date().toISOString().slice(0, 10)}`;
      return bambooRequest('GET', `/time_off/whos_out/${qs}`, null, creds.api_key, creds.subdomain);
    },
    list_benefit_groups: async (params, creds) => {
      return bambooRequest('GET', '/benefit_groups', null, creds.api_key, creds.subdomain);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
