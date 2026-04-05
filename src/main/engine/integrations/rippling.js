/**
 * Rippling HR & IT Platform API Integration
 */
'use strict';
const https = require('https');

function ripplingRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'app.rippling.com', path: `/api/platform/api${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'rippling',
  name: 'Rippling',
  category: 'hr',
  icon: 'Building2',
  description: 'Manage employees, departments, and devices via the Rippling platform API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ripplingRequest('GET', '/employees?limit=1', null, creds.api_key); return { success: Array.isArray(r) || Array.isArray(r?.results), message: r.message || 'Connected to Rippling' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_employees: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}&offset=${params.offset || 0}`;
      return ripplingRequest('GET', `/employees${qs}`, null, creds.api_key);
    },
    get_employee: async (params, creds) => {
      if (!params.employee_id) throw new Error('employee_id required');
      return ripplingRequest('GET', `/employees/${params.employee_id}`, null, creds.api_key);
    },
    list_departments: async (params, creds) => {
      return ripplingRequest('GET', '/departments', null, creds.api_key);
    },
    list_groups: async (params, creds) => {
      return ripplingRequest('GET', '/groups', null, creds.api_key);
    },
    list_leaves: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.start_date && { start_date: params.start_date }), ...(params.end_date && { end_date: params.end_date }), ...(params.employee_id && { employee_id: params.employee_id }) }).toString();
      return ripplingRequest('GET', `/leaves${qs ? `?${qs}` : ''}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
