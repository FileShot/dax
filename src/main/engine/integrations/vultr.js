/**
 * Vultr Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function vultrReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.vultr.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'vultr',
  name: 'Vultr',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage Vultr cloud instances, block storage, DNS, and Kubernetes clusters.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await vultrReq('GET', '/instances?per_page=1&page=1', null, creds); return { success: true, message: `Connected — ${r.meta?.total ?? 0} instance(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_instances: async (params, creds) => vultrReq('GET', `/instances?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds),
    get_instance: async (params, creds) => {
      if (!params.instance_id) throw new Error('instance_id required');
      return vultrReq('GET', `/instances/${params.instance_id}`, null, creds);
    },
    reboot_instance: async (params, creds) => {
      if (!params.instance_id) throw new Error('instance_id required');
      return vultrReq('POST', `/instances/${params.instance_id}/reboot`, {}, creds);
    },
    list_plans: async (params, creds) => vultrReq('GET', `/plans?type=${params.type || 'vc2'}&per_page=${params.per_page || 25}`, null, creds),
    list_regions: async (params, creds) => vultrReq('GET', '/regions', null, creds),
    list_snapshots: async (params, creds) => vultrReq('GET', `/snapshots?per_page=${params.per_page || 25}`, null, creds),
    list_ssh_keys: async (params, creds) => vultrReq('GET', `/ssh-keys?per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
