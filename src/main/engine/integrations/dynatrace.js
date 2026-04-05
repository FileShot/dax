/**
 * Dynatrace Observability API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dtReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.environment_id ? `${creds.environment_id}.live.dynatrace.com` : creds.api_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { method, hostname: host, path: `/api/v2${path}`, headers: { 'Authorization': `Api-Token ${creds.api_token}`, 'Accept': 'application/json; charset=utf-8', ...(bodyStr && { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'dynatrace',
  name: 'Dynatrace',
  category: 'monitoring',
  icon: 'Activity',
  description: 'Monitor application performance, infrastructure health, and problems with Dynatrace.',
  configFields: [
    { key: 'environment_id', label: 'Environment ID (e.g. abc12345)', type: 'text', required: false },
    { key: 'api_url', label: 'API URL (for managed/on-prem)', type: 'text', required: false },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); if (!creds.environment_id && !creds.api_url) throw new Error('environment_id or api_url required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dtReq('GET', '/metrics?pageSize=1', null, creds); return { success: true, message: 'Dynatrace connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_problems: async (params, creds) => dtReq('GET', `/problems?pageSize=${params.page_size || 50}&problemSelector=${params.selector || 'status("OPEN")'}`, null, creds),
    query_metrics: async (params, creds) => {
      if (!params.metric_selector) throw new Error('metric_selector required');
      return dtReq('GET', `/metrics/query?metricSelector=${encodeURIComponent(params.metric_selector)}&resolution=${params.resolution || '1h'}`, null, creds);
    },
    list_entities: async (params, creds) => dtReq('GET', `/entities?entitySelector=${encodeURIComponent(params.entity_selector || 'type("SERVICE")')}&pageSize=${params.page_size || 25}`, null, creds),
    get_events: async (params, creds) => dtReq('POST', '/events/ingest', { eventType: params.event_type || 'CUSTOM_INFO', title: params.title || 'Dax event', properties: params.properties || {} }, creds),
    run_dql: async (params, creds) => {
      if (!params.query) throw new Error('DQL query required');
      return dtReq('POST', '/query/execute', { query: params.query }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
