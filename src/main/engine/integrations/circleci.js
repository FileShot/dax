/**
 * CircleCI API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function circleReq(method, path, body, apiKey) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'circleci.com', path: `/api/v2${path}`, headers: { 'Circle-Token': apiKey, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'circleci',
  name: 'CircleCI',
  category: 'developer',
  icon: 'GitBranch',
  description: 'Manage CircleCI pipelines, jobs, workflows, and artifacts via the CircleCI API.',
  configFields: [{ key: 'api_key', label: 'Personal API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await circleReq('GET', '/me', null, creds.api_key); if (r.id) return { success: true, message: `Connected as ${r.name || r.login}` }; if (r.message) return { success: false, message: r.message }; return { success: true, message: 'Connected to CircleCI' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_pipelines: async (params, creds) => {
      if (!params.project_slug) throw new Error('project_slug required (e.g. gh/org/repo)');
      return circleReq('GET', `/project/${params.project_slug}/pipeline?page-token=${params.page_token || ''}`, null, creds.api_key);
    },
    trigger_pipeline: async (params, creds) => {
      if (!params.project_slug) throw new Error('project_slug required');
      const body = { ...(params.branch && { branch: params.branch }), ...(params.tag && { tag: params.tag }), ...(params.parameters && { parameters: params.parameters }) };
      return circleReq('POST', `/project/${params.project_slug}/pipeline`, body, creds.api_key);
    },
    get_pipeline: async (params, creds) => {
      if (!params.pipeline_id) throw new Error('pipeline_id required');
      return circleReq('GET', `/pipeline/${params.pipeline_id}`, null, creds.api_key);
    },
    get_workflow: async (params, creds) => {
      if (!params.workflow_id) throw new Error('workflow_id required');
      return circleReq('GET', `/workflow/${params.workflow_id}`, null, creds.api_key);
    },
    list_jobs: async (params, creds) => {
      if (!params.workflow_id) throw new Error('workflow_id required');
      return circleReq('GET', `/workflow/${params.workflow_id}/job`, null, creds.api_key);
    },
    cancel_workflow: async (params, creds) => {
      if (!params.workflow_id) throw new Error('workflow_id required');
      return circleReq('POST', `/workflow/${params.workflow_id}/cancel`, null, creds.api_key);
    },
    rerun_workflow: async (params, creds) => {
      if (!params.workflow_id) throw new Error('workflow_id required');
      const body = { ...(params.from_failed && { from_failed: true }) };
      return circleReq('POST', `/workflow/${params.workflow_id}/rerun`, body, creds.api_key);
    },
    list_artifacts: async (params, creds) => {
      if (!params.job_number || !params.project_slug) throw new Error('project_slug and job_number required');
      return circleReq('GET', `/project/${params.project_slug}/${params.job_number}/artifacts`, null, creds.api_key);
    },
    get_job_details: async (params, creds) => {
      if (!params.job_number || !params.project_slug) throw new Error('project_slug and job_number required');
      return circleReq('GET', `/project/${params.project_slug}/job/${params.job_number}`, null, creds.api_key);
    },
    list_project_envvars: async (params, creds) => {
      if (!params.project_slug) throw new Error('project_slug required');
      return circleReq('GET', `/project/${params.project_slug}/envvar`, null, creds.api_key);
    },
    create_project_envvar: async (params, creds) => {
      if (!params.project_slug || !params.name || !params.value) throw new Error('project_slug, name, and value required');
      return circleReq('POST', `/project/${params.project_slug}/envvar`, { name: params.name, value: params.value }, creds.api_key);
    },
    list_contexts: async (params, creds) => {
      if (!params.owner_id) throw new Error('owner_id required');
      return circleReq('GET', `/context?owner-id=${params.owner_id}&page-token=${params.page_token || ''}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
