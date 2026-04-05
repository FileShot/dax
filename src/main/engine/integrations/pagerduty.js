/**
 * PagerDuty API Integration
 */
'use strict';
const https = require('https');

function pdApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.pagerduty.com', path, headers: { 'Authorization': `Token token=${token}`, 'Accept': 'application/vnd.pagerduty+json;version=2', 'Content-Type': 'application/json' } };
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
  id: 'pagerduty',
  name: 'PagerDuty',
  category: 'logging',
  icon: 'Bell',
  description: 'Manage incidents, services, and on-call schedules in PagerDuty.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pdApi('GET', '/abilities', creds.api_token); return { success: Array.isArray(r.abilities), message: 'Connected to PagerDuty' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_incidents: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 25, offset: params.offset || 0 });
      if (params.status) qs.set('statuses[]', params.status);
      if (params.service_ids) qs.set('service_ids[]', params.service_ids);
      return pdApi('GET', `/incidents?${qs}`, creds.api_token);
    },
    get_incident: async (params, creds) => { if (!params.incident_id) throw new Error('incident_id required'); return pdApi('GET', `/incidents/${params.incident_id}`, creds.api_token); },
    create_incident: async (params, creds) => {
      if (!params.title || !params.service_id) throw new Error('title and service_id required');
      return pdApi('POST', '/incidents', creds.api_token, { incident: { type: 'incident', title: params.title, service: { id: params.service_id, type: 'service_reference' }, urgency: params.urgency || 'high', body: { type: 'incident_body', details: params.details || '' } } });
    },
    acknowledge_incident: async (params, creds) => { if (!params.incident_id) throw new Error('incident_id required'); return pdApi('PUT', `/incidents/${params.incident_id}`, creds.api_token, { incident: { type: 'incident_reference', status: 'acknowledged' } }); },
    resolve_incident: async (params, creds) => { if (!params.incident_id) throw new Error('incident_id required'); return pdApi('PUT', `/incidents/${params.incident_id}`, creds.api_token, { incident: { type: 'incident_reference', status: 'resolved' } }); },

    list_services: async (params, creds) => {
      return pdApi('GET', `/services?limit=${params.limit || 25}&offset=${params.offset || 0}`, creds.api_token);
    },

    list_schedules: async (params, creds) => {
      return pdApi('GET', `/schedules?limit=${params.limit || 25}`, creds.api_token);
    },

    list_on_calls: async (params, creds) => {
      const qs = params.schedule_ids ? `?schedule_ids[]=${params.schedule_ids}` : '';
      return pdApi('GET', `/oncalls${qs}`, creds.api_token);
    },

    create_note: async (params, creds) => {
      if (!params.incident_id || !params.content) throw new Error('incident_id and content required');
      return pdApi('POST', `/incidents/${params.incident_id}/notes`, creds.api_token, { note: { content: params.content } });
    },

    snooze_incident: async (params, creds) => {
      if (!params.incident_id || !params.duration) throw new Error('incident_id and duration (seconds) required');
      return pdApi('POST', `/incidents/${params.incident_id}/snooze`, creds.api_token, { duration: params.duration });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
