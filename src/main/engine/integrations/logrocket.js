/**
 * LogRocket Session Replay & Monitoring Integration
 */
'use strict';
const https = require('https');

function logrocketReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'api.logrocket.com', path: `/v1${path}`,
      headers: { 'Authorization': apiKey, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
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
  id: 'logrocket',
  name: 'LogRocket',
  category: 'analytics',
  icon: 'Video',
  description: 'Access LogRocket session replays, issues, and user analytics data.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'org_slug', label: 'Organization Slug', type: 'text', required: true },
    { key: 'project_slug', label: 'Project Slug', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.org_slug || !creds.project_slug) throw new Error('API key, org slug, and project slug required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await logrocketReq('GET', `/orgs/${creds.org_slug}/projects/${creds.project_slug}/`, creds.api_key); if (r.detail) return { success: false, message: r.detail }; return { success: true, message: `Connected to project: ${r.name || creds.project_slug}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_sessions: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.offset && { offset: String(params.offset) }), ...(params.user_email && { user_email: params.user_email }) }).toString();
      return logrocketReq('GET', `/orgs/${creds.org_slug}/projects/${creds.project_slug}/sessions/?${qs}`, creds.api_key);
    },
    get_session: async (params, creds) => {
      if (!params.session_id) throw new Error('session_id required');
      return logrocketReq('GET', `/orgs/${creds.org_slug}/projects/${creds.project_slug}/sessions/${params.session_id}/`, creds.api_key);
    },
    list_issues: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.resolved !== undefined && { resolved: String(params.resolved) }) }).toString();
      return logrocketReq('GET', `/orgs/${creds.org_slug}/projects/${creds.project_slug}/issues/?${qs}`, creds.api_key);
    },
    get_project: async (_params, creds) => {
      return logrocketReq('GET', `/orgs/${creds.org_slug}/projects/${creds.project_slug}/`, creds.api_key);
    },
    list_team_members: async (_params, creds) => {
      return logrocketReq('GET', `/orgs/${creds.org_slug}/members/`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
