/**
 * Render Cloud Hosting Platform API Integration
 */
'use strict';
const https = require('https');

function renderRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.render.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'render',
  name: 'Render',
  category: 'devtools',
  icon: 'Cloud',
  description: 'Deploy and manage web services, databases, and cron jobs on Render.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await renderRequest('GET', '/owners?limit=1', null, creds.api_key); return { success: Array.isArray(r), message: Array.isArray(r) ? 'Connected to Render' : JSON.stringify(r) }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_services: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}${params.type ? `&type=${params.type}` : ''}`;
      return renderRequest('GET', `/services${qs}`, null, creds.api_key);
    },
    get_service: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return renderRequest('GET', `/services/${params.service_id}`, null, creds.api_key);
    },
    deploy_service: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      const body = { clearCache: params.clear_cache ? 'clear' : 'do_not_clear' };
      return renderRequest('POST', `/services/${params.service_id}/deploys`, body, creds.api_key);
    },
    list_deploys: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      const qs = `?limit=${params.limit || 20}`;
      return renderRequest('GET', `/services/${params.service_id}/deploys${qs}`, null, creds.api_key);
    },
    suspend_service: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return renderRequest('POST', `/services/${params.service_id}/suspend`, {}, creds.api_key);
    },
    resume_service: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return renderRequest('POST', `/services/${params.service_id}/resume`, {}, creds.api_key);
    },
    get_deploy: async (params, creds) => {
      if (!params.service_id || !params.deploy_id) throw new Error('service_id and deploy_id required');
      return renderRequest('GET', `/services/${params.service_id}/deploys/${params.deploy_id}`, null, creds.api_key);
    },
    list_env_vars: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return renderRequest('GET', `/services/${params.service_id}/env-vars`, null, creds.api_key);
    },
    update_env_var: async (params, creds) => {
      if (!params.service_id || !params.key || !params.value) throw new Error('service_id, key, and value required');
      return renderRequest('PUT', `/services/${params.service_id}/env-vars/${params.key}`, { value: params.value }, creds.api_key);
    },
    list_headers: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return renderRequest('GET', `/services/${params.service_id}/headers`, null, creds.api_key);
    },
    list_custom_domains: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return renderRequest('GET', `/services/${params.service_id}/custom-domains`, null, creds.api_key);
    },
    scale_service: async (params, creds) => {
      if (!params.service_id || !params.num_instances) throw new Error('service_id and num_instances required');
      return renderRequest('POST', `/services/${params.service_id}/scale`, { numInstances: params.num_instances }, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
