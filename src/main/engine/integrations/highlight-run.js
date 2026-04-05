/**
 * Highlight.run Session Replay & Error Monitoring API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function hlReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'pri.highlight.io', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

// Highlight uses GraphQL for data access
function hlGraphQL(query, variables, creds) {
  const body = JSON.stringify({ query, variables: variables || {} });
  const token = Buffer.from(`api.highlight.io:${creds.api_key}`).toString('base64');
  const opts = { method: 'POST', hostname: 'api.highlight.io', path: '/v1/graphql', headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
  return makeRequest(opts, body);
}

module.exports = {
  id: 'highlight-run',
  name: 'Highlight.run',
  category: 'monitoring',
  icon: 'Video',
  description: 'Access session replays, errors, and logs captured by Highlight.run via GraphQL.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.project_id) throw new Error('api_key and project_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await hlGraphQL(`query { project(id: ${parseInt(creds.project_id, 10)}) { name } }`, {}, creds);
      return { success: true, message: `Project: ${r.data?.project?.name || creds.project_id}` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_sessions: async (params, creds) => hlGraphQL(`query { sessions(project_id: ${parseInt(creds.project_id, 10)}, count: ${params.count || 10}) { sessions { id created_at email } } }`, {}, creds),
    get_errors: async (params, creds) => hlGraphQL(`query { error_groups(project_id: ${parseInt(creds.project_id, 10)}, count: ${params.count || 25}) { error_groups { id event type } } }`, {}, creds),
    get_logs: async (params, creds) => hlGraphQL(`query { logs(project_id: ${parseInt(creds.project_id, 10)}, params: { query: "${params.query || ''}", date_range: { start_date: "${params.start || new Date(Date.now() - 3600000).toISOString()}", end_date: "${params.end || new Date().toISOString()}" } }) { edges { node { timestamp message } } } }`, {}, creds),
    get_project: async (params, creds) => hlGraphQL(`query { project(id: ${parseInt(creds.project_id, 10)}) { id name verbose_id } }`, {}, creds),
    get_error_group: async (params, creds) => {
      if (!params.error_group_id) throw new Error('error_group_id required');
      return hlGraphQL(`query { error_group(secure_id: "${params.error_group_id}") { id event type occurrences } }`, {}, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
