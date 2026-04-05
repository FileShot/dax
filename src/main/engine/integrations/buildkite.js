/**
 * Buildkite CI/CD API Integration
 */
'use strict';
const https = require('https');

function buildkiteRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.buildkite.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'buildkite',
  name: 'Buildkite',
  category: 'devtools',
  icon: 'Wrench',
  description: 'Manage CI/CD pipelines, builds, and agents with Buildkite.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'org_slug', label: 'Organization Slug', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_token || !creds.org_slug) throw new Error('API token and org slug required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await buildkiteRequest('GET', `/organizations/${creds.org_slug}`, null, creds.api_token); return { success: !!r.slug, message: r.message || `Connected — ${r.name || creds.org_slug}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_pipelines: async (params, creds) => {
      const qs = `?page=${params.page || 1}&per_page=${params.per_page || 20}`;
      return buildkiteRequest('GET', `/organizations/${creds.org_slug}/pipelines${qs}`, null, creds.api_token);
    },
    get_pipeline: async (params, creds) => {
      if (!params.pipeline_slug) throw new Error('pipeline_slug required');
      return buildkiteRequest('GET', `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}`, null, creds.api_token);
    },
    list_builds: async (params, creds) => {
      const qs = new URLSearchParams({ page: String(params.page || 1), per_page: String(params.per_page || 20), ...(params.state && { state: params.state }) }).toString();
      const path = params.pipeline_slug ? `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}/builds?${qs}` : `/organizations/${creds.org_slug}/builds?${qs}`;
      return buildkiteRequest('GET', path, null, creds.api_token);
    },
    get_build: async (params, creds) => {
      if (!params.pipeline_slug || !params.build_number) throw new Error('pipeline_slug and build_number required');
      return buildkiteRequest('GET', `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}/builds/${params.build_number}`, null, creds.api_token);
    },
    create_build: async (params, creds) => {
      if (!params.pipeline_slug || !params.commit || !params.branch) throw new Error('pipeline_slug, commit, and branch required');
      const body = { commit: params.commit, branch: params.branch, ...(params.message && { message: params.message }), ...(params.env && { env: params.env }), ...(params.meta_data && { meta_data: params.meta_data }) };
      return buildkiteRequest('POST', `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}/builds`, body, creds.api_token);
    },
    cancel_build: async (params, creds) => {
      if (!params.pipeline_slug || !params.build_number) throw new Error('pipeline_slug and build_number required');
      return buildkiteRequest('PUT', `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}/builds/${params.build_number}/cancel`, {}, creds.api_token);
    },
    rebuild_build: async (params, creds) => {
      if (!params.pipeline_slug || !params.build_number) throw new Error('pipeline_slug and build_number required');
      return buildkiteRequest('PUT', `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}/builds/${params.build_number}/rebuild`, {}, creds.api_token);
    },
    list_agents: async (params, creds) => {
      const qs = `?page=${params.page || 1}&per_page=${params.per_page || 20}`;
      return buildkiteRequest('GET', `/organizations/${creds.org_slug}/agents${qs}`, null, creds.api_token);
    },
    get_agent: async (params, creds) => {
      if (!params.agent_id) throw new Error('agent_id required');
      return buildkiteRequest('GET', `/organizations/${creds.org_slug}/agents/${params.agent_id}`, null, creds.api_token);
    },
    stop_agent: async (params, creds) => {
      if (!params.agent_id) throw new Error('agent_id required');
      return buildkiteRequest('PUT', `/organizations/${creds.org_slug}/agents/${params.agent_id}/stop`, { force: !!params.force }, creds.api_token);
    },
    list_artifacts: async (params, creds) => {
      if (!params.pipeline_slug || !params.build_number) throw new Error('pipeline_slug and build_number required');
      return buildkiteRequest('GET', `/organizations/${creds.org_slug}/pipelines/${params.pipeline_slug}/builds/${params.build_number}/artifacts`, null, creds.api_token);
    },
    create_pipeline: async (params, creds) => {
      if (!params.name || !params.repository) throw new Error('name and repository required');
      const body = { name: params.name, repository: params.repository, ...(params.steps && { steps: params.steps }), ...(params.default_branch && { default_branch: params.default_branch }) };
      return buildkiteRequest('POST', `/organizations/${creds.org_slug}/pipelines`, body, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
