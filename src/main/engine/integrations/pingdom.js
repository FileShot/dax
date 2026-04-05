/**
 * Pingdom API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function pingReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.pingdom.com', path: `/api/3.1${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'pingdom',
  name: 'Pingdom',
  category: 'monitoring',
  icon: 'Wifi',
  description: 'Track uptime checks, outages, and performance summaries from Pingdom.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pingReq('GET', '/checks?limit=1', null, creds); return { success: true, message: `Connected — ${r.counts?.total ?? 0} check(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_checks: async (params, creds) => pingReq('GET', `/checks?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    get_check: async (params, creds) => {
      if (!params.check_id) throw new Error('check_id required');
      return pingReq('GET', `/checks/${params.check_id}`, null, creds);
    },
    get_summary: async (params, creds) => {
      if (!params.check_id) throw new Error('check_id required');
      const from = params.from || Math.floor(Date.now() / 1000) - 86400;
      const to = params.to || Math.floor(Date.now() / 1000);
      return pingReq('GET', `/summary.performance/${params.check_id}?from=${from}&to=${to}&resolution=${params.resolution || 'day'}`, null, creds);
    },
    list_outages: async (params, creds) => {
      if (!params.check_id) throw new Error('check_id required');
      return pingReq('GET', `/summary.outage/${params.check_id}`, null, creds);
    },
    get_credits: async (params, creds) => pingReq('GET', '/credits', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
