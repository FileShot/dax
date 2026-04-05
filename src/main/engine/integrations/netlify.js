/**
 * Netlify API Integration
 */
'use strict';
const https = require('https');

function netlifyApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.netlify.com', path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'netlify',
  name: 'Netlify',
  category: 'devops',
  icon: 'Globe',
  description: 'Manage Netlify sites, deploys, and forms.',
  configFields: [
    { key: 'api_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await netlifyApi('GET', '/user', creds.api_token); return { success: !!r.id, message: r.id ? `Authenticated as ${r.full_name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_sites: async (params, creds) => netlifyApi('GET', `/sites?per_page=${params.limit || 20}`, creds.api_token),
    get_site: async (params, creds) => { if (!params.site_id) throw new Error('site_id required'); return netlifyApi('GET', `/sites/${params.site_id}`, creds.api_token); },
    list_deploys: async (params, creds) => { if (!params.site_id) throw new Error('site_id required'); return netlifyApi('GET', `/sites/${params.site_id}/deploys?per_page=${params.limit || 10}`, creds.api_token); },
    get_deploy: async (params, creds) => { if (!params.deploy_id) throw new Error('deploy_id required'); return netlifyApi('GET', `/deploys/${params.deploy_id}`, creds.api_token); },
    lock_deploy: async (params, creds) => { if (!params.deploy_id) throw new Error('deploy_id required'); return netlifyApi('POST', `/deploys/${params.deploy_id}/lock`, creds.api_token); },
    unlock_deploy: async (params, creds) => { if (!params.deploy_id) throw new Error('deploy_id required'); return netlifyApi('POST', `/deploys/${params.deploy_id}/unlock`, creds.api_token); },
    list_forms: async (params, creds) => { if (!params.site_id) throw new Error('site_id required'); return netlifyApi('GET', `/sites/${params.site_id}/forms`, creds.api_token); },
    list_submissions: async (params, creds) => { if (!params.form_id) throw new Error('form_id required'); return netlifyApi('GET', `/forms/${params.form_id}/submissions?per_page=${params.limit || 20}`, creds.api_token); },
    cancel_deploy: async (params, creds) => { if (!params.deploy_id) throw new Error('deploy_id required'); return netlifyApi('POST', `/deploys/${params.deploy_id}/cancel`, creds.api_token); },
    restore_deploy: async (params, creds) => { if (!params.site_id || !params.deploy_id) throw new Error('site_id and deploy_id required'); return netlifyApi('POST', `/sites/${params.site_id}/deploys/${params.deploy_id}/restore`, creds.api_token); },
    list_hooks: async (params, creds) => { if (!params.site_id) throw new Error('site_id required'); return netlifyApi('GET', `/hooks?site_id=${params.site_id}`, creds.api_token); },
    list_dns_zones: async (params, creds) => netlifyApi('GET', '/dns_zones', creds.api_token),
    list_env_vars: async (params, creds) => {
      if (!params.account_slug || !params.site_id) throw new Error('account_slug and site_id required');
      return netlifyApi('GET', `/accounts/${params.account_slug}/env?site_id=${params.site_id}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
