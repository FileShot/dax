/**
 * Mezmo (formerly LogDNA) Log Management API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function mezmoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.service_key}:`).toString('base64');
  const opts = { method, hostname: 'api.mezmo.com', path: `/v1${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'mezmo',
  name: 'Mezmo',
  category: 'monitoring',
  icon: 'Terminal',
  description: 'Ingest, search, and analyze logs and manage alerts in Mezmo (formerly LogDNA).',
  configFields: [{ key: 'service_key', label: 'Service Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.service_key) throw new Error('service_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mezmoReq('GET', '/config/alerts', null, creds); return { success: true, message: `Connected — ${(r || []).length} alert(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_logs: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const from = params.from || Math.floor(Date.now() / 1000) - 3600;
      const to = params.to || Math.floor(Date.now() / 1000);
      return mezmoReq('GET', `/export?from=${from}&to=${to}&query=${encodeURIComponent(params.query)}&size=${params.size || 100}`, null, creds);
    },
    list_views: async (params, creds) => mezmoReq('GET', '/config/view', null, creds),
    get_alerts: async (params, creds) => mezmoReq('GET', '/config/alerts', null, creds),
    create_alert: async (params, creds) => {
      if (!params.name || !params.channels) throw new Error('name and channels required');
      return mezmoReq('POST', '/config/alerts', { name: params.name, channels: params.channels, triggers: params.triggers || [] }, creds);
    },
    list_ingestion_keys: async (params, creds) => mezmoReq('GET', '/config/ingestionkeys', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
