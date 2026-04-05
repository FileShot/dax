/**
 * Sentry API Integration
 */
'use strict';
const https = require('https');

function sentryApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'sentry.io', path: `/api/0${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'sentry',
  name: 'Sentry',
  category: 'monitoring',
  icon: 'AlertTriangle',
  description: 'Monitor errors, issues, and performance in Sentry.',
  configFields: [
    { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
    { key: 'org_slug', label: 'Organization Slug', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.auth_token || !creds.org_slug) throw new Error('Auth token and org slug required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sentryApi('GET', `/organizations/${creds.org_slug}/`, creds.auth_token); return { success: !!r.id, message: r.id ? `Connected to ${r.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => sentryApi('GET', `/organizations/${creds.org_slug}/projects/`, creds.auth_token),
    list_issues: async (params, creds) => {
      if (!params.project_slug) throw new Error('project_slug required');
      const query = params.query ? `&query=${encodeURIComponent(params.query)}` : '';
      return sentryApi('GET', `/projects/${creds.org_slug}/${params.project_slug}/issues/?limit=${params.limit || 20}${query}`, creds.auth_token);
    },
    get_issue: async (params, creds) => { if (!params.issue_id) throw new Error('issue_id required'); return sentryApi('GET', `/issues/${params.issue_id}/`, creds.auth_token); },
    get_issue_events: async (params, creds) => { if (!params.issue_id) throw new Error('issue_id required'); return sentryApi('GET', `/issues/${params.issue_id}/events/?limit=${params.limit || 10}`, creds.auth_token); },
    resolve_issue: async (params, creds) => { if (!params.issue_id) throw new Error('issue_id required'); return sentryApi('PUT', `/issues/${params.issue_id}/`, creds.auth_token, { status: 'resolved' }); },

    ignore_issue: async (params, creds) => {
      if (!params.issue_id) throw new Error('issue_id required');
      return sentryApi('PUT', `/issues/${params.issue_id}/`, creds.auth_token, { status: 'ignored' });
    },

    delete_issue: async (params, creds) => {
      if (!params.issue_id) throw new Error('issue_id required');
      await sentryApi('DELETE', `/issues/${params.issue_id}/`, creds.auth_token);
      return { success: true, deleted: params.issue_id };
    },

    list_releases: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}`;
      return sentryApi('GET', `/organizations/${creds.org_slug}/releases/${qs}`, creds.auth_token);
    },

    create_release: async (params, creds) => {
      if (!params.version) throw new Error('version required');
      return sentryApi('POST', `/organizations/${creds.org_slug}/releases/`, creds.auth_token, {
        version: params.version, projects: params.projects || [], refs: params.refs || [], url: params.url,
      });
    },

    list_teams: async (params, creds) => {
      return sentryApi('GET', `/organizations/${creds.org_slug}/teams/`, creds.auth_token);
    },

    get_project: async (params, creds) => {
      if (!params.project_slug) throw new Error('project_slug required');
      return sentryApi('GET', `/projects/${creds.org_slug}/${params.project_slug}/`, creds.auth_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
