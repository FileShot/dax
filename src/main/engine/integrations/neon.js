/**
 * Neon Serverless Postgres API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function neonReq(method, path, body, apiKey) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'console.neon.tech', path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'neon',
  name: 'Neon',
  category: 'developer',
  icon: 'Zap',
  description: 'Manage Neon serverless Postgres projects, branches, and endpoints via the Neon API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await neonReq('GET', '/projects', null, creds.api_key); if (r.projects !== undefined) return { success: true, message: `Connected to Neon — ${r.projects.length} project(s)` }; if (r.code) return { success: false, message: r.message }; return { success: true, message: 'Connected to Neon' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => {
      return neonReq('GET', '/projects', null, creds.api_key);
    },
    get_project: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return neonReq('GET', `/projects/${params.project_id}`, null, creds.api_key);
    },
    list_branches: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return neonReq('GET', `/projects/${params.project_id}/branches`, null, creds.api_key);
    },
    get_branch: async (params, creds) => {
      if (!params.project_id || !params.branch_id) throw new Error('project_id and branch_id required');
      return neonReq('GET', `/projects/${params.project_id}/branches/${params.branch_id}`, null, creds.api_key);
    },
    list_endpoints: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return neonReq('GET', `/projects/${params.project_id}/endpoints`, null, creds.api_key);
    },
    create_project: async (params, creds) => {
      const body = { project: { name: params.name || 'new-project', ...(params.region_id && { region_id: params.region_id }) } };
      return neonReq('POST', '/projects', body, creds.api_key);
    },
    delete_project: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return neonReq('DELETE', `/projects/${params.project_id}`, null, creds.api_key);
    },
    create_branch: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const body = { branch: { ...(params.name && { name: params.name }), ...(params.parent_id && { parent_id: params.parent_id }) }, ...(params.endpoints && { endpoints: params.endpoints }) };
      return neonReq('POST', `/projects/${params.project_id}/branches`, body, creds.api_key);
    },
    delete_branch: async (params, creds) => {
      if (!params.project_id || !params.branch_id) throw new Error('project_id and branch_id required');
      return neonReq('DELETE', `/projects/${params.project_id}/branches/${params.branch_id}`, null, creds.api_key);
    },
    list_databases: async (params, creds) => {
      if (!params.project_id || !params.branch_id) throw new Error('project_id and branch_id required');
      return neonReq('GET', `/projects/${params.project_id}/branches/${params.branch_id}/databases`, null, creds.api_key);
    },
    get_connection_uri: async (params, creds) => {
      if (!params.project_id || !params.branch_id) throw new Error('project_id and branch_id required');
      const qs = params.database_name ? `?database_name=${params.database_name}` : '';
      return neonReq('GET', `/projects/${params.project_id}/connection_uri${qs}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
