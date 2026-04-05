/**
 * Opsgenie API Integration
 */
'use strict';
const https = require('https');

function ogApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.opsgenie.com', path: `/v2${path}`, headers: { 'Authorization': `GenieKey ${apiKey}`, 'Content-Type': 'application/json' } };
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
  id: 'opsgenie',
  name: 'Opsgenie',
  category: 'logging',
  icon: 'AlertTriangle',
  description: 'Create and manage alerts and on-call schedules in Opsgenie.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ogApi('GET', '/alerts/count', creds.api_key); return { success: r.data !== undefined, message: `${r.data?.count || 0} active alert(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_alerts: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 20 });
      if (params.status) qs.set('query', `status: ${params.status}`);
      return ogApi('GET', `/alerts?${qs}`, creds.api_key);
    },
    get_alert: async (params, creds) => { if (!params.alert_id) throw new Error('alert_id required'); return ogApi('GET', `/alerts/${params.alert_id}`, creds.api_key); },
    create_alert: async (params, creds) => {
      if (!params.message) throw new Error('message required');
      return ogApi('POST', '/alerts', creds.api_key, { message: params.message, alias: params.alias || '', description: params.description || '', priority: params.priority || 'P3', tags: params.tags || [], details: params.details || {} });
    },
    close_alert: async (params, creds) => { if (!params.alert_id) throw new Error('alert_id required'); return ogApi('POST', `/alerts/${params.alert_id}/close`, creds.api_key, { note: params.note || 'Closed via Dax' }); },
    list_schedules: async (params, creds) => ogApi('GET', '/schedules', creds.api_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
