/**
 * Freshstatus API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fsReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.api_key}:X`).toString('base64');
  const opts = { method, hostname: `${creds.subdomain}.freshstatus.io`, path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'freshstatus',
  name: 'Freshstatus',
  category: 'monitoring',
  icon: 'CheckSquare',
  description: 'Manage status pages, incidents, and subscribers with Freshstatus.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'subdomain', label: 'Subdomain (e.g. mycompany)', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.subdomain) throw new Error('api_key and subdomain required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fsReq('GET', '/service/', null, creds); return { success: true, message: `Found ${(r.results || []).length} service(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_services: async (params, creds) => fsReq('GET', '/service/', null, creds),
    list_incidents: async (params, creds) => fsReq('GET', `/incident/?page=${params.page || 1}&is_resolved=${params.is_resolved ?? false}`, null, creds),
    create_incident: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return fsReq('POST', '/incident/', { title: params.title, description: params.description || '', status: params.status || 'INVESTIGATING', impact: params.impact || 'MINOR' }, creds);
    },
    get_status_page: async (params, creds) => fsReq('GET', '/status_page/', null, creds),
    list_subscribers: async (params, creds) => fsReq('GET', `/subscriber/?page=${params.page || 1}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
