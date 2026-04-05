/**
 * Harbor Container Registry REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function harborRequest(method, path, body, creds) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const useHttps = creds.use_https !== 'false';
    const adapter = useHttps ? https : http;
    const port = parseInt(creds.port) || (useHttps ? 443 : 80);
    const opts = { method, hostname: creds.hostname, port, path: `/api/v2.0${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = adapter.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, statusCode: res.statusCode }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'harbor',
  name: 'Harbor',
  category: 'devtools',
  icon: 'Ship',
  description: 'Manage container images, projects, and repositories in Harbor container registry.',
  configFields: [
    { key: 'hostname', label: 'Harbor Hostname', type: 'text', required: true },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'port', label: 'Port (optional)', type: 'text', required: false },
    { key: 'use_https', label: 'Use HTTPS', type: 'select', options: ['true', 'false'], required: false },
  ],
  async connect(creds) { if (!creds.hostname || !creds.username || !creds.password) throw new Error('Hostname, username, and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await harborRequest('GET', '/systeminfo', null, creds); return { success: !!r.harbor_version || r.statusCode === 200, message: r.errors?.[0]?.message || `Connected — Harbor ${r.harbor_version || ''}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => {
      const qs = `?page=${params.page || 1}&page_size=${params.page_size || 20}`;
      return harborRequest('GET', `/projects${qs}`, null, creds);
    },
    get_project: async (params, creds) => {
      if (!params.project_name) throw new Error('project_name required');
      return harborRequest('GET', `/projects/${params.project_name}`, null, creds);
    },
    list_repositories: async (params, creds) => {
      if (!params.project_name) throw new Error('project_name required');
      const qs = `?page=${params.page || 1}&page_size=${params.page_size || 20}`;
      return harborRequest('GET', `/projects/${params.project_name}/repositories${qs}`, null, creds);
    },
    list_artifacts: async (params, creds) => {
      if (!params.project_name || !params.repository_name) throw new Error('project_name and repository_name required');
      const qs = `?page=${params.page || 1}&page_size=${params.page_size || 20}`;
      return harborRequest('GET', `/projects/${params.project_name}/repositories/${encodeURIComponent(params.repository_name)}/artifacts${qs}`, null, creds);
    },
    delete_artifact: async (params, creds) => {
      if (!params.project_name || !params.repository_name || !params.reference) throw new Error('project_name, repository_name, and reference required');
      return harborRequest('DELETE', `/projects/${params.project_name}/repositories/${encodeURIComponent(params.repository_name)}/artifacts/${params.reference}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
