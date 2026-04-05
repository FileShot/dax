/**
 * PlanetScale Database API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function psReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = `Basic ${Buffer.from(`${creds.service_token_id}:${creds.service_token}`).toString('base64')}`;
  const opts = { method, hostname: 'api.planetscale.com', path: `/v1${path}`, headers: { 'Authorization': auth, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'planetscale',
  name: 'PlanetScale',
  category: 'developer',
  icon: 'Database',
  description: 'Manage PlanetScale MySQL-compatible databases, branches, and deploy requests.',
  configFields: [
    { key: 'service_token_id', label: 'Service Token ID', type: 'text', required: true },
    { key: 'service_token', label: 'Service Token', type: 'password', required: true },
    { key: 'org', label: 'Organization Name', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.service_token_id || !creds.service_token || !creds.org) throw new Error('service_token_id, service_token, and org required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await psReq('GET', `/organizations/${creds.org}/databases`, null, creds); if (r.code === 401) return { success: false, message: 'Unauthorized — check credentials' }; return { success: true, message: 'Connected to PlanetScale' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_databases: async (params, creds) => {
      return psReq('GET', `/organizations/${creds.org}/databases`, null, creds);
    },
    get_database: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return psReq('GET', `/organizations/${creds.org}/databases/${params.database}`, null, creds);
    },
    list_branches: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return psReq('GET', `/organizations/${creds.org}/databases/${params.database}/branches`, null, creds);
    },
    get_branch: async (params, creds) => {
      if (!params.database || !params.branch) throw new Error('database and branch required');
      return psReq('GET', `/organizations/${creds.org}/databases/${params.database}/branches/${params.branch}`, null, creds);
    },
    list_deploy_requests: async (params, creds) => {
      if (!params.database) throw new Error('database required');
      return psReq('GET', `/organizations/${creds.org}/databases/${params.database}/deploy-requests`, null, creds);
    },
    create_deploy_request: async (params, creds) => {
      if (!params.database || !params.branch) throw new Error('database and branch required');
      return psReq('POST', `/organizations/${creds.org}/databases/${params.database}/deploy-requests`, { branch: params.branch, ...(params.into_branch && { into_branch: params.into_branch }) }, creds);
    },
    create_branch: async (params, creds) => {
      if (!params.database || !params.name) throw new Error('database and name required');
      return psReq('POST', `/organizations/${creds.org}/databases/${params.database}/branches`, { name: params.name, ...(params.parent_branch && { parent_branch: params.parent_branch }) }, creds);
    },
    delete_branch: async (params, creds) => {
      if (!params.database || !params.branch) throw new Error('database and branch required');
      return psReq('DELETE', `/organizations/${creds.org}/databases/${params.database}/branches/${params.branch}`, null, creds);
    },
    get_branch_schema: async (params, creds) => {
      if (!params.database || !params.branch) throw new Error('database and branch required');
      return psReq('GET', `/organizations/${creds.org}/databases/${params.database}/branches/${params.branch}/schema`, null, creds);
    },
    list_passwords: async (params, creds) => {
      if (!params.database) throw new Error('database required');
      return psReq('GET', `/organizations/${creds.org}/databases/${params.database}/passwords`, null, creds);
    },
    create_password: async (params, creds) => {
      if (!params.database || !params.branch) throw new Error('database and branch required');
      return psReq('POST', `/organizations/${creds.org}/databases/${params.database}/passwords`, { branch: params.branch, ...(params.name && { name: params.name }) }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
