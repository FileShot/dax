/**
 * Scaleway Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function scwReq(method, zone, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const region = zone || 'fr-par-1';
  const opts = { method, hostname: 'api.scaleway.com', path: `/instance/v1/zones/${region}${path}`, headers: { 'X-Auth-Token': creds.secret_key, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'scaleway',
  name: 'Scaleway',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage Scaleway cloud servers, volumes, IPs, and security groups.',
  configFields: [
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
    { key: 'organization_id', label: 'Organization ID', type: 'string', required: false },
    { key: 'default_zone', label: 'Default Zone', type: 'string', required: false, description: 'e.g. fr-par-1 (default)' },
  ],
  async connect(creds) { if (!creds.secret_key) throw new Error('secret_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await scwReq('GET', creds.default_zone || 'fr-par-1', '/servers?per_page=1', null, creds); return { success: true, message: `Connected — ${r.total_count ?? 0} server(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_servers: async (params, creds) => scwReq('GET', params.zone || creds.default_zone || 'fr-par-1', `/servers?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds),
    get_server: async (params, creds) => {
      if (!params.server_id) throw new Error('server_id required');
      return scwReq('GET', params.zone || creds.default_zone || 'fr-par-1', `/servers/${params.server_id}`, null, creds);
    },
    perform_server_action: async (params, creds) => {
      if (!params.server_id || !params.action) throw new Error('server_id and action required (poweron/poweroff/reboot)');
      return scwReq('POST', params.zone || creds.default_zone || 'fr-par-1', `/servers/${params.server_id}/action`, { action: params.action }, creds);
    },
    list_volumes: async (params, creds) => scwReq('GET', params.zone || creds.default_zone || 'fr-par-1', `/volumes?per_page=${params.per_page || 25}`, null, creds),
    list_ips: async (params, creds) => scwReq('GET', params.zone || creds.default_zone || 'fr-par-1', `/ips?per_page=${params.per_page || 25}`, null, creds),
    list_images: async (params, creds) => scwReq('GET', params.zone || creds.default_zone || 'fr-par-1', `/images?per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
