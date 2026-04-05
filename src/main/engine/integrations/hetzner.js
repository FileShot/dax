/**
 * Hetzner Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function hetznerReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.hetzner.cloud', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'hetzner',
  name: 'Hetzner Cloud',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage Hetzner Cloud servers, volumes, SSH keys, and networking.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hetznerReq('GET', '/servers?page=1&per_page=1', null, creds); return { success: true, message: `Connected — ${r.meta?.pagination?.total_entries ?? 0} server(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_servers: async (params, creds) => hetznerReq('GET', `/servers?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    get_server: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return hetznerReq('GET', `/servers/${params.id}`, null, creds);
    },
    create_server: async (params, creds) => {
      if (!params.name || !params.server_type || !params.image) throw new Error('name, server_type, and image required');
      return hetznerReq('POST', '/servers', { name: params.name, server_type: params.server_type, image: params.image, location: params.location, ssh_keys: params.ssh_keys || [] }, creds);
    },
    reboot_server: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return hetznerReq('POST', `/servers/${params.id}/actions/reboot`, {}, creds);
    },
    list_ssh_keys: async (params, creds) => hetznerReq('GET', `/ssh_keys?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    list_volumes: async (params, creds) => hetznerReq('GET', `/volumes?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    list_datacenters: async (params, creds) => hetznerReq('GET', '/datacenters', null, creds),
    delete_server: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return hetznerReq('DELETE', `/servers/${params.id}`, null, creds);
    },
    power_on_server: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return hetznerReq('POST', `/servers/${params.id}/actions/poweron`, {}, creds);
    },
    power_off_server: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return hetznerReq('POST', `/servers/${params.id}/actions/poweroff`, {}, creds);
    },
    list_images: async (params, creds) => hetznerReq('GET', `/images?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    list_firewalls: async (params, creds) => hetznerReq('GET', '/firewalls', null, creds),
    list_networks: async (params, creds) => hetznerReq('GET', '/networks', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
