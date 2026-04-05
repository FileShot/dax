/**
 * Statuspage.io (Atlassian) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function spReq(method, pagePath, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.statuspage.io', path: `/v1/pages/${creds.page_id}${pagePath}`, headers: { 'Authorization': `OAuth ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'statuspage-io',
  name: 'Statuspage',
  category: 'monitoring',
  icon: 'Globe',
  description: 'Manage your Statuspage incidents, components, and subscribers via the Atlassian Statuspage API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'page_id', label: 'Page ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.page_id) throw new Error('api_key and page_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await spReq('GET', '', null, creds); return { success: true, message: `Page: ${r.name} (${r.subdomain})` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_page: async (params, creds) => spReq('GET', '', null, creds),
    list_incidents: async (params, creds) => spReq('GET', `/incidents?q=${encodeURIComponent(params.q || '')}&limit=${params.limit || 25}`, null, creds),
    get_incident: async (params, creds) => {
      if (!params.incident_id) throw new Error('incident_id required');
      return spReq('GET', `/incidents/${params.incident_id}`, null, creds);
    },
    list_components: async (params, creds) => spReq('GET', '/components', null, creds),
    create_incident: async (params, creds) => {
      if (!params.name) throw new Error('incident name required');
      return spReq('POST', '/incidents', { incident: { name: params.name, status: params.status || 'investigating', impact_override: params.impact || 'none', body: params.body || '' } }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
