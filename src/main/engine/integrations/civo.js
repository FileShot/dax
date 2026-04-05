/**
 * Civo Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function civoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const region = creds.region || 'LON1';
  const opts = { method, hostname: 'api.civo.com', path: `/v2${path}?region=${region}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'civo',
  name: 'Civo',
  category: 'cloud',
  icon: 'Server',
  description: 'Manage Civo cloud instances, Kubernetes clusters, networks, and firewalls.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'region', label: 'Region', type: 'string', required: false, description: 'e.g. LON1, NYC1, FRA1 (default: LON1)' },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await civoReq('GET', '/instances', null, creds); return { success: true, message: `Connected — ${r.items?.length ?? 0} instance(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_instances: async (params, creds) => civoReq('GET', `/instances?per_page=${params.per_page || 20}&page=${params.page || 1}`, null, creds),
    get_instance: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return civoReq('GET', `/instances/${params.id}`, null, creds);
    },
    reboot_instance: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return civoReq('POST', `/instances/${params.id}/hard_reboots`, {}, creds);
    },
    list_kubernetes_clusters: async (params, creds) => civoReq('GET', `/kubernetes/clusters?per_page=${params.per_page || 20}&page=${params.page || 1}`, null, creds),
    list_networks: async (params, creds) => civoReq('GET', '/networks', null, creds),
    list_firewall_rules: async (params, creds) => {
      if (!params.firewall_id) throw new Error('firewall_id required');
      return civoReq('GET', `/firewalls/${params.firewall_id}/rules`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
