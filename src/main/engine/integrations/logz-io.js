/**
 * Logz.io Log Management API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function logzReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const region = creds.region || 'us';
  const hostname = region === 'eu' ? 'api-eu.logz.io' : `api.logz.io`;
  const opts = { method, hostname, path: `/v1${path}`, headers: { 'X-API-TOKEN': creds.api_token, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'logz-io',
  name: 'Logz.io',
  category: 'monitoring',
  icon: 'Search',
  description: 'Search logs, manage alerts, and run OpenSearch queries in Logz.io.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'region', label: 'Region (us or eu)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await logzReq('GET', '/account-management', null, creds); return { success: true, message: `Account: ${r.accountName || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_logs: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return logzReq('POST', '/search', { query: { query_string: { query: params.query } }, size: params.size || 50, from: params.from || 0 }, creds);
    },
    list_alerts: async (params, creds) => logzReq('GET', '/alerts', null, creds),
    get_alert: async (params, creds) => {
      if (!params.alert_id) throw new Error('alert_id required');
      return logzReq('GET', `/alerts/${params.alert_id}`, null, creds);
    },
    trigger_alert: async (params, creds) => {
      if (!params.alert_id) throw new Error('alert_id required');
      return logzReq('POST', `/alerts/${params.alert_id}/trigger`, {}, creds);
    },
    get_account: async (params, creds) => logzReq('GET', '/account-management', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
