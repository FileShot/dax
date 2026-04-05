/**
 * UpCloud Cloud Hosting API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function upcloudReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  const opts = { method, hostname: 'api.upcloud.com', path: `/1.3${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'upcloud',
  name: 'UpCloud',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage UpCloud servers, storage, IP addresses, and networking.',
  configFields: [
    { key: 'username', label: 'API Username', type: 'string', required: true },
    { key: 'password', label: 'API Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.username || !creds.password) throw new Error('username and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await upcloudReq('GET', '/server', null, creds); return { success: true, message: `Connected — ${r.servers?.server?.length ?? 0} server(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_servers: async (params, creds) => upcloudReq('GET', '/server', null, creds),
    get_server: async (params, creds) => {
      if (!params.uuid) throw new Error('uuid required');
      return upcloudReq('GET', `/server/${params.uuid}`, null, creds);
    },
    start_server: async (params, creds) => {
      if (!params.uuid) throw new Error('uuid required');
      return upcloudReq('POST', `/server/${params.uuid}/start`, {}, creds);
    },
    stop_server: async (params, creds) => {
      if (!params.uuid) throw new Error('uuid required');
      return upcloudReq('POST', `/server/${params.uuid}/stop`, { stop_server: { stop_type: params.stop_type || 'soft', timeout: params.timeout || 60 } }, creds);
    },
    list_ip_addresses: async (params, creds) => upcloudReq('GET', '/ip_address', null, creds),
    list_storage: async (params, creds) => upcloudReq('GET', `/storage${params.type ? `/${params.type}` : ''}`, null, creds),
    restart_server: async (params, creds) => {
      if (!params.uuid) throw new Error('uuid required');
      return upcloudReq('POST', `/server/${params.uuid}/restart`, { restart_server: { stop_type: params.stop_type || 'soft', timeout: params.timeout || 60 } }, creds);
    },
    delete_server: async (params, creds) => {
      if (!params.uuid) throw new Error('uuid required');
      return upcloudReq('DELETE', `/server/${params.uuid}`, null, creds);
    },
    create_server: async (params, creds) => {
      if (!params.hostname || !params.plan || !params.zone) throw new Error('hostname, plan, and zone required');
      return upcloudReq('POST', '/server', { server: { hostname: params.hostname, plan: params.plan, zone: params.zone, title: params.title || params.hostname, ...(params.storage_devices && { storage_devices: params.storage_devices }) } }, creds);
    },
    list_zones: async (params, creds) => upcloudReq('GET', '/zone', null, creds),
    list_plans: async (params, creds) => upcloudReq('GET', '/plan', null, creds),
    list_firewalls: async (params, creds) => {
      if (!params.uuid) throw new Error('server uuid required');
      return upcloudReq('GET', `/server/${params.uuid}/firewall_rule`, null, creds);
    },
    get_account: async (params, creds) => upcloudReq('GET', '/account', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
