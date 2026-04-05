/**
 * Airbrake Error Monitoring API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function airReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.airbrake.io', path: `/api/v4/projects/${creds.project_id}${path}?key=${creds.project_key}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'airbrake',
  name: 'Airbrake',
  category: 'monitoring',
  icon: 'AlertOctagon',
  description: 'Track and resolve application errors and deploys in Airbrake.',
  configFields: [
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
    { key: 'project_key', label: 'Project Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.project_id || !creds.project_key) throw new Error('project_id and project_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await airReq('GET', '/groups?limit=1', null, creds); return { success: true, message: `Connected to project ${creds.project_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_groups: async (params, creds) => airReq('GET', `/groups?limit=${params.limit || 25}&page=${params.page || 1}`, null, creds),
    get_group: async (params, creds) => {
      if (!params.group_id) throw new Error('group_id required');
      return airReq('GET', `/groups/${params.group_id}`, null, creds);
    },
    list_notices: async (params, creds) => {
      if (!params.group_id) throw new Error('group_id required');
      return airReq('GET', `/groups/${params.group_id}/notices?limit=${params.limit || 25}`, null, creds);
    },
    resolve_group: async (params, creds) => {
      if (!params.group_id) throw new Error('group_id required');
      return airReq('PATCH', `/groups/${params.group_id}`, { group: { resolved: true } }, creds);
    },
    create_deploy: async (params, creds) => {
      if (!params.environment) throw new Error('environment required');
      return airReq('POST', '/deploys', { deploy: { environment: params.environment, username: params.username, revision: params.revision, repository: params.repository } }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
