/**
 * UptimeRobot API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function urPost(path, fields, creds) {
  const params = new URLSearchParams({ api_key: creds.api_key, format: 'json', ...fields });
  const body = params.toString();
  const opts = { method: 'POST', hostname: 'api.uptimerobot.com', path: `/v2${path}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
  return makeRequest(opts, body);
}

module.exports = {
  id: 'uptimerobot',
  name: 'UptimeRobot',
  category: 'monitoring',
  icon: 'Activity',
  description: 'Manage uptime monitors, alert contacts, and maintenance windows in UptimeRobot.',
  configFields: [{ key: 'api_key', label: 'API Key (Main or Monitor)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await urPost('/getAccountDetails', {}, creds); if (r.stat !== 'ok') throw new Error(r.error?.message || 'API error'); return { success: true, message: `Plan: ${r.account?.plan_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_monitors: async (params, creds) => urPost('/getMonitors', { limit: params.limit || 50, offset: params.offset || 0, search: params.search || '' }, creds),
    get_monitor: async (params, creds) => {
      if (!params.monitor_id) throw new Error('monitor_id required');
      return urPost('/getMonitors', { monitors: params.monitor_id, response_times: 1, logs: 1 }, creds);
    },
    get_account_details: async (params, creds) => urPost('/getAccountDetails', {}, creds),
    get_alert_contacts: async (params, creds) => urPost('/getAlertContacts', { limit: params.limit || 50 }, creds),
    new_monitor: async (params, creds) => {
      if (!params.friendly_name || !params.url) throw new Error('friendly_name and url required');
      return urPost('/newMonitor', { friendly_name: params.friendly_name, url: params.url, type: params.type || 1 }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
