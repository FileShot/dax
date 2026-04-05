/**
 * Linode (Akamai Cloud) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function linodeReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.linode.com', path: `/v4${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'linode',
  name: 'Linode',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage Linode instances, volumes, domains, and cloud infrastructure via API.',
  configFields: [{ key: 'api_token', label: 'Personal Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await linodeReq('GET', '/linode/instances?page=1&page_size=1', null, creds); return { success: true, message: `Connected — ${r.results ?? 0} Linode(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_linodes: async (params, creds) => linodeReq('GET', `/linode/instances?page=${params.page || 1}&page_size=${params.page_size || 25}`, null, creds),
    get_linode: async (params, creds) => {
      if (!params.linode_id) throw new Error('linode_id required');
      return linodeReq('GET', `/linode/instances/${params.linode_id}`, null, creds);
    },
    reboot_linode: async (params, creds) => {
      if (!params.linode_id) throw new Error('linode_id required');
      return linodeReq('POST', `/linode/instances/${params.linode_id}/reboot`, {}, creds);
    },
    list_volumes: async (params, creds) => linodeReq('GET', `/volumes?page=${params.page || 1}&page_size=${params.page_size || 25}`, null, creds),
    list_domains: async (params, creds) => linodeReq('GET', `/domains?page=${params.page || 1}&page_size=${params.page_size || 25}`, null, creds),
    get_account: async (params, creds) => linodeReq('GET', '/account', null, creds),
    list_regions: async (params, creds) => linodeReq('GET', '/regions', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
