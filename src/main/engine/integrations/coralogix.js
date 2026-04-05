/**
 * Coralogix Observability API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function coraReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'ng-api.coralogix.com', path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'coralogix',
  name: 'Coralogix',
  category: 'monitoring',
  icon: 'Activity',
  description: 'Query logs, metrics, and traces and manage alerting rules in Coralogix.',
  configFields: [{ key: 'api_key', label: 'Logs Query Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await coraReq('GET', '/team', null, creds);
      return { success: true, message: `Team: ${r.teamName || r.id}` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query_logs: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return coraReq('POST', '/logs/query', { query: params.query, startDate: params.start_date || new Date(Date.now() - 3600000).toISOString(), endDate: params.end_date || new Date().toISOString(), limit: params.limit || 50 }, creds);
    },
    list_alerts: async (params, creds) => {
      const opts = { method: 'GET', hostname: 'api.coralogix.com', path: '/api/v1/external/alerts', headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json' } };
      return makeRequest(opts, null);
    },
    send_logs: async (params, creds) => {
      if (!params.log_entries || !params.private_key) throw new Error('log_entries and private_key required');
      const body = JSON.stringify({ privateKey: params.private_key, applicationName: params.app || 'Dax', subsystemName: params.subsystem || 'default', logEntries: params.log_entries });
      const opts = { method: 'POST', hostname: 'api.coralogix.com', path: '/logs/rest/singles', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
      return makeRequest(opts, body);
    },
    get_team: async (params, creds) => coraReq('GET', '/team', null, creds),
    list_dashboards: async (params, creds) => coraReq('GET', '/dashboards', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
