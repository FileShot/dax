/**
 * Better Stack (formerly Better Uptime) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bsReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'uptime.betterstack.com', path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'betterstack',
  name: 'Better Stack',
  category: 'monitoring',
  icon: 'TrendingUp',
  description: 'Manage uptime monitors, heartbeats, and on-call schedules with Better Stack.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bsReq('GET', '/monitors?per_page=1', null, creds); return { success: true, message: `Connected — pagination cursor found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_monitors: async (params, creds) => bsReq('GET', `/monitors?per_page=${params.per_page || 25}`, null, creds),
    get_monitor: async (params, creds) => {
      if (!params.monitor_id) throw new Error('monitor_id required');
      return bsReq('GET', `/monitors/${params.monitor_id}`, null, creds);
    },
    create_monitor: async (params, creds) => {
      if (!params.url) throw new Error('url required');
      return bsReq('POST', '/monitors', { url: params.url, monitor_type: params.monitor_type || 'status', friendly_name: params.friendly_name || params.url }, creds);
    },
    list_incidents: async (params, creds) => bsReq('GET', `/incidents?per_page=${params.per_page || 25}`, null, creds),
    list_heartbeats: async (params, creds) => bsReq('GET', `/heartbeats?per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
