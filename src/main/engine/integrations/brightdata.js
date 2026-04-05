/**
 * Bright Data Proxy & Dataset API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bdReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.brightdata.com', path, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'brightdata',
  name: 'Bright Data',
  category: 'data',
  icon: 'Network',
  description: 'Manage proxy zones, IPs, and web datasets via Bright Data API.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bdReq('GET', '/zone/get_all_zones', null, creds); return { success: true, message: `Connected — ${Array.isArray(r) ? r.length : 0} zone(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_zones: async (params, creds) => bdReq('GET', '/zone/get_all_zones', null, creds),
    get_zone: async (params, creds) => {
      if (!params.zone) throw new Error('zone required');
      return bdReq('GET', `/zone?zone=${encodeURIComponent(params.zone)}`, null, creds);
    },
    get_zone_ips: async (params, creds) => {
      if (!params.zone) throw new Error('zone required');
      return bdReq('GET', `/zone/ips?zone=${encodeURIComponent(params.zone)}`, null, creds);
    },
    get_zone_stats: async (params, creds) => {
      if (!params.zone) throw new Error('zone required');
      return bdReq('GET', `/zone/statistics?zone=${encodeURIComponent(params.zone)}&from=${params.from || ''}&to=${params.to || ''}`, null, creds);
    },
    add_whitelist_ip: async (params, creds) => {
      if (!params.zone || !params.ips) throw new Error('zone and ips required');
      return bdReq('POST', '/zone/ips', { zone: params.zone, ips: Array.isArray(params.ips) ? params.ips : [params.ips] }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
