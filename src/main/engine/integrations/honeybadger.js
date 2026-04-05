/**
 * Honeybadger Error Monitoring API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function hbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = 'Basic ' + Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname: 'app.honeybadger.io', path: `/v2${path}`, headers: { 'Authorization': auth, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'honeybadger',
  name: 'Honeybadger',
  category: 'monitoring',
  icon: 'Bug',
  description: 'Monitor errors, track faults, and manage projects in Honeybadger.',
  configFields: [{ key: 'api_key', label: 'Personal Auth Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hbReq('GET', '/projects', null, creds); return { success: true, message: `Found ${(r.results || []).length} project(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => hbReq('GET', '/projects', null, creds),
    list_faults: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const qs = params.q ? `?q=${encodeURIComponent(params.q)}` : '';
      return hbReq('GET', `/projects/${params.project_id}/faults${qs}`, null, creds);
    },
    get_fault: async (params, creds) => {
      if (!params.project_id || !params.fault_id) throw new Error('project_id and fault_id required');
      return hbReq('GET', `/projects/${params.project_id}/faults/${params.fault_id}`, null, creds);
    },
    get_notices: async (params, creds) => {
      if (!params.project_id || !params.fault_id) throw new Error('project_id and fault_id required');
      return hbReq('GET', `/projects/${params.project_id}/faults/${params.fault_id}/notices`, null, creds);
    },
    resolve_fault: async (params, creds) => {
      if (!params.project_id || !params.fault_id) throw new Error('project_id and fault_id required');
      return hbReq('PUT', `/projects/${params.project_id}/faults/${params.fault_id}`, { fault: { resolved: true } }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
