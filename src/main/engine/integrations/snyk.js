/**
 * Snyk Security API Integration
 */
'use strict';
const https = require('https');

function snykApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.snyk.io', path: `/rest${path}`, headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/vnd.api+json' } };
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

function snykV1(method, path, token) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.snyk.io', path: `/v1${path}`, headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'snyk',
  name: 'Snyk',
  category: 'security',
  icon: 'ShieldAlert',
  description: 'Scan and monitor for security vulnerabilities with Snyk.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'org_id', label: 'Organization ID', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await snykV1('GET', '/user/me', creds.api_token); return { success: !!r.id, message: r.username ? `Connected as ${r.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_orgs: async (params, creds) => snykV1('GET', '/orgs', creds.api_token),
    list_projects: async (params, creds) => {
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('GET', `/org/${orgId}/projects`, creds.api_token);
    },
    get_project_issues: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('POST', `/org/${orgId}/project/${params.project_id}/issues`, creds.api_token);
    },
    get_user: async (params, creds) => snykV1('GET', '/user/me', creds.api_token),
    get_project: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('GET', `/org/${orgId}/project/${params.project_id}`, creds.api_token);
    },
    delete_project: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('DELETE', `/org/${orgId}/project/${params.project_id}`, creds.api_token);
    },
    list_ignores: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('GET', `/org/${orgId}/project/${params.project_id}/ignores`, creds.api_token);
    },
    list_dependencies: async (params, creds) => {
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('POST', `/org/${orgId}/dependencies`, creds.api_token);
    },
    list_licenses: async (params, creds) => {
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('POST', `/org/${orgId}/licenses`, creds.api_token);
    },
    get_org_settings: async (params, creds) => {
      const orgId = params.org_id || creds.org_id;
      if (!orgId) throw new Error('org_id required');
      return snykV1('GET', `/org/${orgId}/settings`, creds.api_token);
    },
    test_npm_package: async (params, creds) => {
      if (!params.package_name || !params.version) throw new Error('package_name and version required');
      return snykV1('GET', `/test/npm/${encodeURIComponent(params.package_name)}/${params.version}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
