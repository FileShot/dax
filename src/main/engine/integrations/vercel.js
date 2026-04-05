/**
 * Vercel API Integration
 */
'use strict';
const https = require('https');

function vercelApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.vercel.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'vercel',
  name: 'Vercel',
  category: 'devops',
  icon: 'Triangle',
  description: 'Manage Vercel projects, deployments, and domains.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await vercelApi('GET', '/v2/user', creds.api_token); return { success: !!r.user?.id, message: r.user?.id ? `Authenticated as ${r.user.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => vercelApi('GET', `/v9/projects?limit=${params.limit || 20}`, creds.api_token),
    get_project: async (params, creds) => { if (!params.project_id) throw new Error('project_id required'); return vercelApi('GET', `/v9/projects/${params.project_id}`, creds.api_token); },
    list_deployments: async (params, creds) => {
      let path = `/v6/deployments?limit=${params.limit || 20}`;
      if (params.project_id) path += `&projectId=${params.project_id}`;
      return vercelApi('GET', path, creds.api_token);
    },
    get_deployment: async (params, creds) => { if (!params.deployment_id) throw new Error('deployment_id required'); return vercelApi('GET', `/v13/deployments/${params.deployment_id}`, creds.api_token); },
    list_domains: async (params, creds) => vercelApi('GET', `/v5/domains?limit=${params.limit || 20}`, creds.api_token),
    list_env_vars: async (params, creds) => { if (!params.project_id) throw new Error('project_id required'); return vercelApi('GET', `/v9/projects/${params.project_id}/env`, creds.api_token); },
    create_env_var: async (params, creds) => {
      if (!params.project_id || !params.key || !params.value) throw new Error('project_id, key, and value required');
      return vercelApi('POST', `/v10/projects/${params.project_id}/env`, creds.api_token, { type: params.type || 'encrypted', key: params.key, value: params.value, target: params.target || ['production', 'preview', 'development'] });
    },
    delete_deployment: async (params, creds) => { if (!params.deployment_id) throw new Error('deployment_id required'); return vercelApi('DELETE', `/v13/deployments/${params.deployment_id}`, creds.api_token); },
    cancel_deployment: async (params, creds) => { if (!params.deployment_id) throw new Error('deployment_id required'); return vercelApi('PATCH', `/v12/deployments/${params.deployment_id}/cancel`, creds.api_token); },
    add_domain: async (params, creds) => { if (!params.name) throw new Error('domain name required'); return vercelApi('POST', '/v5/domains', creds.api_token, { name: params.name }); },
    delete_domain: async (params, creds) => { if (!params.name) throw new Error('domain name required'); return vercelApi('DELETE', `/v6/domains/${params.name}`, creds.api_token); },
    create_project: async (params, creds) => { if (!params.name) throw new Error('project name required'); return vercelApi('POST', '/v10/projects', creds.api_token, { name: params.name, ...(params.framework && { framework: params.framework }), ...(params.git_repository && { gitRepository: params.git_repository }) }); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
