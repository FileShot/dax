/**
 * Gusto Payroll & HR API Integration
 */
'use strict';
const https = require('https');

function gustoApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.gusto.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'gusto',
  name: 'Gusto',
  category: 'hr',
  icon: 'Users',
  description: 'Manage payroll, employees, and HR in Gusto.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'company_id', label: 'Company ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.company_id) throw new Error('Access token and company ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gustoApi('GET', `/companies/${creds.company_id}`, creds.access_token); return { success: !!r.id, message: r.name ? `Connected to ${r.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => gustoApi('GET', `/companies/${creds.company_id}/employees?page=${params.page || 1}&per=${params.limit || 25}`, creds.access_token),
    get_employee: async (params, creds) => { if (!params.employee_id) throw new Error('employee_id required'); return gustoApi('GET', `/employees/${params.employee_id}`, creds.access_token); },
    list_payrolls: async (params, creds) => gustoApi('GET', `/companies/${creds.company_id}/payrolls`, creds.access_token),
    get_company: async (params, creds) => gustoApi('GET', `/companies/${creds.company_id}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
