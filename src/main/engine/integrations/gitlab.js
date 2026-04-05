/**
 * GitLab API Integration
 */
'use strict';
const https = require('https');

function gitlabApi(method, path, token, body = null, host = 'gitlab.com') {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: host, path: `/api/v4${path}`, headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } };
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
  id: 'gitlab',
  name: 'GitLab',
  category: 'devops',
  icon: 'GitBranch',
  description: 'Manage GitLab projects, issues, merge requests, and pipelines.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
    { key: 'host', label: 'GitLab Host (default: gitlab.com)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gitlabApi('GET', '/user', creds.access_token, null, creds.host || 'gitlab.com'); return { success: !!r.id, message: r.id ? `Authenticated as @${r.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_projects: async (params, creds) => {
      const limit = params.limit || 20;
      return gitlabApi('GET', `/projects?membership=true&per_page=${limit}&order_by=updated_at`, creds.access_token, null, creds.host);
    },
    get_issues: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const limit = params.limit || 20;
      const state = params.state || 'opened';
      return gitlabApi('GET', `/projects/${params.project_id}/issues?state=${state}&per_page=${limit}`, creds.access_token, null, creds.host);
    },
    create_issue: async (params, creds) => {
      if (!params.project_id || !params.title) throw new Error('project_id and title required');
      const body = { title: params.title };
      if (params.description) body.description = params.description;
      if (params.labels) body.labels = params.labels;
      if (params.assignee_ids) body.assignee_ids = params.assignee_ids;
      return gitlabApi('POST', `/projects/${params.project_id}/issues`, creds.access_token, body, creds.host);
    },
    get_merge_requests: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const state = params.state || 'opened';
      return gitlabApi('GET', `/projects/${params.project_id}/merge_requests?state=${state}&per_page=20`, creds.access_token, null, creds.host);
    },
    get_pipelines: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return gitlabApi('GET', `/projects/${params.project_id}/pipelines?per_page=20`, creds.access_token, null, creds.host);
    },
    trigger_pipeline: async (params, creds) => {
      if (!params.project_id || !params.ref) throw new Error('project_id and ref required');
      return gitlabApi('POST', `/projects/${params.project_id}/pipeline`, creds.access_token, { ref: params.ref }, creds.host);
    },
    create_merge_request: async (params, creds) => {
      if (!params.project_id || !params.source_branch || !params.target_branch || !params.title) throw new Error('project_id, source_branch, target_branch, and title required');
      return gitlabApi('POST', `/projects/${params.project_id}/merge_requests`, creds.access_token, { source_branch: params.source_branch, target_branch: params.target_branch, title: params.title, ...(params.description && { description: params.description }) }, creds.host);
    },
    get_project: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return gitlabApi('GET', `/projects/${params.project_id}`, creds.access_token, null, creds.host);
    },
    list_branches: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return gitlabApi('GET', `/projects/${params.project_id}/repository/branches?per_page=20`, creds.access_token, null, creds.host);
    },
    list_jobs: async (params, creds) => {
      if (!params.project_id || !params.pipeline_id) throw new Error('project_id and pipeline_id required');
      return gitlabApi('GET', `/projects/${params.project_id}/pipelines/${params.pipeline_id}/jobs`, creds.access_token, null, creds.host);
    },
    retry_pipeline: async (params, creds) => {
      if (!params.project_id || !params.pipeline_id) throw new Error('project_id and pipeline_id required');
      return gitlabApi('POST', `/projects/${params.project_id}/pipelines/${params.pipeline_id}/retry`, creds.access_token, null, creds.host);
    },
    list_milestones: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return gitlabApi('GET', `/projects/${params.project_id}/milestones?per_page=20`, creds.access_token, null, creds.host);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
