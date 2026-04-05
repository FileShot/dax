/**
 * Mixpanel Analytics Integration
 */
'use strict';
const https = require('https');

function mixpanelApi(method, hostname, path, headers, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'mixpanel',
  name: 'Mixpanel',
  category: 'analytics',
  icon: 'PieChart',
  description: 'Track events and analyze user behavior with Mixpanel.',
  configFields: [
    { key: 'project_token', label: 'Project Token', type: 'password', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: false },
    { key: 'project_id', label: 'Project ID', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.project_token) throw new Error('Project token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { return { success: !!creds.project_token, message: creds.project_token ? 'Token configured' : 'No token' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    track_event: async (params, creds) => {
      if (!params.event) throw new Error('event name required');
      const data = [{ event: params.event, properties: { token: creds.project_token, distinct_id: params.distinct_id || 'server', time: Math.floor(Date.now() / 1000), ...(params.properties || {}) } }];
      return mixpanelApi('POST', 'api.mixpanel.com', '/import?strict=1', { 'Authorization': `Basic ${Buffer.from(creds.api_secret + ':').toString('base64')}` }, data);
    },
    get_top_events: async (params, creds) => {
      const auth = Buffer.from(creds.api_secret + ':').toString('base64');
      const limit = params.limit || 10;
      return mixpanelApi('GET', 'mixpanel.com', `/api/2.0/events/top?project_id=${creds.project_id}&limit=${limit}`, { 'Authorization': `Basic ${auth}` });
    },
    get_event_stats: async (params, creds) => {
      if (!params.event) throw new Error('event name required');
      const auth = Buffer.from(creds.api_secret + ':').toString('base64');
      const from = params.from_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = params.to_date || new Date().toISOString().slice(0, 10);
      return mixpanelApi('GET', 'mixpanel.com', `/api/2.0/events?project_id=${creds.project_id}&event=${encodeURIComponent(JSON.stringify([params.event]))}&from_date=${from}&to_date=${to}&unit=day`, { 'Authorization': `Basic ${auth}` });
    },
    get_profiles: async (params, creds) => {
      const auth = Buffer.from(creds.api_secret + ':').toString('base64');
      const where = params.where ? `&where=${encodeURIComponent(params.where)}` : '';
      return mixpanelApi('GET', 'mixpanel.com', `/api/2.0/engage?project_id=${creds.project_id}${where}`, { 'Authorization': `Basic ${auth}` });
    },

    set_profile: async (params, creds) => {
      if (!params.distinct_id) throw new Error('distinct_id required');
      const data = [{ $token: creds.project_token, $distinct_id: params.distinct_id, $set: params.properties || {} }];
      return mixpanelApi('POST', 'api.mixpanel.com', '/engage', { 'Authorization': `Basic ${Buffer.from(creds.api_secret + ':').toString('base64')}` }, data);
    },

    get_funnel: async (params, creds) => {
      if (!params.funnel_id) throw new Error('funnel_id required');
      const auth = Buffer.from(creds.api_secret + ':').toString('base64');
      const from = params.from_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = params.to_date || new Date().toISOString().slice(0, 10);
      return mixpanelApi('GET', 'mixpanel.com', `/api/2.0/funnels?project_id=${creds.project_id}&funnel_id=${params.funnel_id}&from_date=${from}&to_date=${to}`, { 'Authorization': `Basic ${auth}` });
    },

    get_retention: async (params, creds) => {
      const auth = Buffer.from(creds.api_secret + ':').toString('base64');
      const from = params.from_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = params.to_date || new Date().toISOString().slice(0, 10);
      return mixpanelApi('GET', 'mixpanel.com', `/api/2.0/retention?project_id=${creds.project_id}&from_date=${from}&to_date=${to}&retention_type=${params.retention_type || 'birth'}`, { 'Authorization': `Basic ${auth}` });
    },

    track_batch: async (params, creds) => {
      if (!params.events || !Array.isArray(params.events)) throw new Error('events array required');
      const data = params.events.map((e) => ({ event: e.event, properties: { token: creds.project_token, distinct_id: e.distinct_id || 'server', time: Math.floor(Date.now() / 1000), ...e.properties } }));
      return mixpanelApi('POST', 'api.mixpanel.com', '/import?strict=1', { 'Authorization': `Basic ${Buffer.from(creds.api_secret + ':').toString('base64')}` }, data);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
