/**
 * Bugsnag Error Monitoring API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bsReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.bugsnag.com', path, headers: { 'Authorization': `token ${creds.auth_token}`, 'Accept': 'application/json; version=2', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'bugsnag',
  name: 'Bugsnag',
  category: 'monitoring',
  icon: 'Bug',
  description: 'Monitor and triage application errors across web and mobile apps with Bugsnag.',
  configFields: [{ key: 'auth_token', label: 'Personal Auth Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.auth_token) throw new Error('auth_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bsReq('GET', '/user', null, creds); return { success: true, message: `Authenticated as ${r.email || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => {
      if (!params.organization_id) throw new Error('organization_id required');
      return bsReq('GET', `/organizations/${params.organization_id}/projects?sort=creation_time&direction=desc&per_page=${params.per_page || 20}`, null, creds);
    },
    list_errors: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const q = params.query ? `&q=${encodeURIComponent(params.query)}` : '';
      return bsReq('GET', `/projects/${params.project_id}/errors?sort=events&direction=desc&per_page=${params.per_page || 20}${q}`, null, creds);
    },
    get_error: async (params, creds) => {
      if (!params.project_id || !params.error_id) throw new Error('project_id and error_id required');
      return bsReq('GET', `/projects/${params.project_id}/errors/${params.error_id}`, null, creds);
    },
    list_events: async (params, creds) => {
      if (!params.project_id || !params.error_id) throw new Error('project_id and error_id required');
      return bsReq('GET', `/projects/${params.project_id}/errors/${params.error_id}/events?per_page=${params.per_page || 20}`, null, creds);
    },
    mark_error_fixed: async (params, creds) => {
      if (!params.project_id || !params.error_id) throw new Error('project_id and error_id required');
      return bsReq('PATCH', `/projects/${params.project_id}/errors/${params.error_id}`, { status: 'fixed' }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
