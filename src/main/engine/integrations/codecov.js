/**
 * Codecov Code Coverage API Integration
 */
'use strict';
const https = require('https');

function codecovRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'codecov.io', path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'codecov',
  name: 'Codecov',
  category: 'devtools',
  icon: 'PieChart',
  description: 'View code coverage reports and trends for repositories using Codecov.',
  configFields: [
    { key: 'token', label: 'API Token', type: 'password', required: true },
    { key: 'service', label: 'Service (github, gitlab, bitbucket)', type: 'text', required: true },
    { key: 'owner', label: 'Owner (username or org)', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.token || !creds.service || !creds.owner) throw new Error('Token, service, and owner required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await codecovRequest('GET', `/${creds.service}/${creds.owner}/`, null, creds.token); return { success: !!r.username, message: r.detail || `Connected — ${r.username || creds.owner}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_repos: async (params, creds) => {
      const qs = `?page_size=${params.page_size || 20}&page=${params.page || 1}`;
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/repos/${qs}`, null, creds.token);
    },
    get_repo: async (params, creds) => {
      if (!params.repo_name) throw new Error('repo_name required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/`, null, creds.token);
    },
    list_commits: async (params, creds) => {
      if (!params.repo_name) throw new Error('repo_name required');
      const qs = `?page_size=${params.page_size || 20}&page=${params.page || 1}`;
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/commits/${qs}`, null, creds.token);
    },
    get_commit: async (params, creds) => {
      if (!params.repo_name || !params.commitid) throw new Error('repo_name and commitid required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/commits/${params.commitid}/`, null, creds.token);
    },
    get_branch: async (params, creds) => {
      if (!params.repo_name || !params.branch) throw new Error('repo_name and branch required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/branches/${params.branch}/`, null, creds.token);
    },
    list_pulls: async (params, creds) => {
      if (!params.repo_name) throw new Error('repo_name required');
      const qs = `?page_size=${params.page_size || 20}&page=${params.page || 1}`;
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/pulls/${qs}`, null, creds.token);
    },
    get_pull: async (params, creds) => {
      if (!params.repo_name || !params.pull_id) throw new Error('repo_name and pull_id required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/pulls/${params.pull_id}/`, null, creds.token);
    },
    list_flags: async (params, creds) => {
      if (!params.repo_name) throw new Error('repo_name required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/flags/`, null, creds.token);
    },
    list_components: async (params, creds) => {
      if (!params.repo_name) throw new Error('repo_name required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/components/`, null, creds.token);
    },
    get_coverage_trend: async (params, creds) => {
      if (!params.repo_name) throw new Error('repo_name required');
      const qs = `?branch=${params.branch || 'main'}`;
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/coverage/trend/${qs}`, null, creds.token);
    },
    compare_commits: async (params, creds) => {
      if (!params.repo_name || !params.base || !params.head) throw new Error('repo_name, base, and head required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/compare/${params.base}...${params.head}/`, null, creds.token);
    },
    get_file_coverage: async (params, creds) => {
      if (!params.repo_name || !params.path) throw new Error('repo_name and path required');
      return codecovRequest('GET', `/${creds.service}/${creds.owner}/${params.repo_name}/file/${params.path}/`, null, creds.token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
