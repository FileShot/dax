/**
 * Sonatype Nexus Repository REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function nexusRequest(method, path, body, creds) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const useHttps = creds.use_https !== 'false';
    const hostname = creds.hostname;
    const port = parseInt(creds.port) || (useHttps ? 443 : 8081);
    const opts = { method, hostname, port, path: `/service/rest${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const adapter = useHttps ? https : http;
    const req = adapter.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, status: res.statusCode }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'nexus',
  name: 'Nexus Repository',
  category: 'devtools',
  icon: 'Package',
  description: 'Manage artifacts, repositories, and components in Sonatype Nexus Repository.',
  configFields: [
    { key: 'hostname', label: 'Hostname (e.g. nexus.example.com)', type: 'text', required: true },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'port', label: 'Port (default 8081)', type: 'text', required: false },
    { key: 'use_https', label: 'Use HTTPS', type: 'select', options: ['true', 'false'], required: false },
  ],
  async connect(creds) { if (!creds.hostname || !creds.username || !creds.password) throw new Error('Hostname, username, and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await nexusRequest('GET', '/v1/status', null, creds); return { success: r.status === 200 || r.raw !== undefined, message: 'Connected to Nexus Repository' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_repositories: async (params, creds) => {
      return nexusRequest('GET', '/v1/repositories', null, creds);
    },
    search_components: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.repository && { repository: params.repository }), ...(params.group && { group: params.group }), ...(params.name && { name: params.name }), ...(params.version && { version: params.version }), ...(params.format && { format: params.format }), ...(params.continuation_token && { continuationToken: params.continuation_token }) }).toString();
      return nexusRequest('GET', `/v1/search${qs ? `?${qs}` : ''}`, null, creds);
    },
    get_component: async (params, creds) => {
      if (!params.component_id) throw new Error('component_id required');
      return nexusRequest('GET', `/v1/components/${params.component_id}`, null, creds);
    },
    delete_component: async (params, creds) => {
      if (!params.component_id) throw new Error('component_id required');
      return nexusRequest('DELETE', `/v1/components/${params.component_id}`, null, creds);
    },
    list_assets: async (params, creds) => {
      const qs = params.repository ? `?repository=${encodeURIComponent(params.repository)}` : '';
      return nexusRequest('GET', `/v1/assets${qs}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
