/**
 * SwaggerHub API Integration
 */
'use strict';
const https = require('https');

function shApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.swaggerhub.com', path, headers: { 'Authorization': apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'swaggerhub',
  name: 'SwaggerHub',
  category: 'documentation',
  icon: 'Code2',
  description: 'Design, document, and host APIs with SwaggerHub.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'owner', label: 'Owner (username or org)', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.owner) throw new Error('API key and owner required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await shApi('GET', `/apis/${creds.owner}`, creds.api_key); return { success: !!r.apis, message: `Found ${r.apis?.length || 0} API(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_apis: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 25, page: params.page || 0 });
      if (params.query) qs.set('query', params.query);
      return shApi('GET', `/apis/${creds.owner}?${qs}`, creds.api_key);
    },
    get_api: async (params, creds) => {
      if (!params.api_name || !params.version) throw new Error('api_name and version required');
      return shApi('GET', `/apis/${creds.owner}/${params.api_name}/${params.version}`, creds.api_key);
    },
    get_api_yaml: async (params, creds) => {
      if (!params.api_name || !params.version) throw new Error('api_name and version required');
      return shApi('GET', `/apis/${creds.owner}/${params.api_name}/${params.version}/swagger.yaml`, creds.api_key);
    },
    delete_api_version: async (params, creds) => {
      if (!params.api_name || !params.version) throw new Error('api_name and version required');
      return shApi('DELETE', `/apis/${creds.owner}/${params.api_name}/${params.version}`, creds.api_key);
    },
    search_apis: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, limit: params.limit || 25 });
      return shApi('GET', `/apis?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
