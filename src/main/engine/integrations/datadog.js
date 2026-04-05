/**
 * Datadog API Integration
 */
'use strict';
const https = require('https');

function ddApi(method, path, apiKey, appKey, body = null, site = 'datadoghq.com') {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `api.${site}`, path: `/api/v1${path}`, headers: { 'DD-API-KEY': apiKey, 'DD-APPLICATION-KEY': appKey, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'datadog',
  name: 'Datadog',
  category: 'monitoring',
  icon: 'Activity',
  description: 'Query metrics, manage monitors, and send events to Datadog.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'app_key', label: 'Application Key', type: 'password', required: true },
    { key: 'site', label: 'Datadog Site (default: datadoghq.com)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_key || !creds.app_key) throw new Error('API key and app key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ddApi('GET', '/validate', creds.api_key, creds.app_key, null, creds.site); return { success: r.valid, message: r.valid ? 'API key valid' : 'Invalid API key' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query_metrics: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const from = params.from || Math.floor(Date.now() / 1000) - 3600;
      const to = params.to || Math.floor(Date.now() / 1000);
      return ddApi('GET', `/query?from=${from}&to=${to}&query=${encodeURIComponent(params.query)}`, creds.api_key, creds.app_key, null, creds.site);
    },
    list_monitors: async (params, creds) => ddApi('GET', `/monitor?page_size=${params.limit || 20}`, creds.api_key, creds.app_key, null, creds.site),
    send_event: async (params, creds) => {
      if (!params.title || !params.text) throw new Error('title and text required');
      return ddApi('POST', '/events', creds.api_key, creds.app_key, { title: params.title, text: params.text, priority: params.priority || 'normal', alert_type: params.alert_type || 'info', tags: params.tags || [] }, creds.site);
    },
    get_dashboards: async (params, creds) => ddApi('GET', '/dashboard', creds.api_key, creds.app_key, null, creds.site),
    list_hosts: async (params, creds) => ddApi('GET', `/hosts?count=${params.limit || 100}`, creds.api_key, creds.app_key, null, creds.site),

    create_monitor: async (params, creds) => {
      if (!params.name || !params.type || !params.query) throw new Error('name, type, and query required');
      return ddApi('POST', '/monitor', creds.api_key, creds.app_key, { name: params.name, type: params.type, query: params.query, message: params.message || '', tags: params.tags || [], options: params.options || {} }, creds.site);
    },

    mute_monitor: async (params, creds) => {
      if (!params.monitor_id) throw new Error('monitor_id required');
      const body = {};
      if (params.end) body.end = params.end;
      return ddApi('POST', `/monitor/${params.monitor_id}/mute`, creds.api_key, creds.app_key, body, creds.site);
    },

    create_downtime: async (params, creds) => {
      if (!params.scope || !params.start) throw new Error('scope and start required');
      return ddApi('POST', '/downtime', creds.api_key, creds.app_key, { scope: Array.isArray(params.scope) ? params.scope : [params.scope], start: params.start, end: params.end || null, message: params.message || '', monitor_id: params.monitor_id }, creds.site);
    },

    list_downtime: async (params, creds) => ddApi('GET', '/downtime', creds.api_key, creds.app_key, null, creds.site),

    submit_metric: async (params, creds) => {
      if (!params.metric || !params.value) throw new Error('metric and value required');
      const point = [Math.floor(Date.now() / 1000), params.value];
      return ddApi('POST', '/series', creds.api_key, creds.app_key, { series: [{ metric: params.metric, type: params.type || 'gauge', points: [point], tags: params.tags || [], host: params.host || 'dax-agent' }] }, creds.site);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
