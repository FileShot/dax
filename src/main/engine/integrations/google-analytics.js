/**
 * Google Analytics 4 Data API Integration
 */
'use strict';
const https = require('https');

function gaApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'analyticsdata.googleapis.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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

function gaAdminApi(method, path, token) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'analyticsadmin.googleapis.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'google-analytics',
  name: 'Google Analytics',
  category: 'analytics',
  icon: 'BarChart2',
  description: 'Query GA4 reports, real-time data, and manage properties.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'property_id', label: 'GA4 Property ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.property_id) throw new Error('Access token and property ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gaAdminApi('GET', `/v1beta/properties/${creds.property_id}`, creds.access_token); return { success: !!r.name, message: r.name ? `Connected to ${r.displayName}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    run_report: async (params, creds) => {
      const body = {
        dateRanges: [{ startDate: params.start_date || '30daysAgo', endDate: params.end_date || 'today' }],
        metrics: (params.metrics || ['sessions']).map((m) => ({ name: m })),
        dimensions: (params.dimensions || []).map((d) => ({ name: d })),
      };
      if (params.limit) body.limit = String(params.limit);
      return gaApi('POST', `/v1beta/properties/${creds.property_id}:runReport`, creds.access_token, body);
    },
    get_realtime: async (params, creds) => {
      const body = {
        metrics: (params.metrics || ['activeUsers']).map((m) => ({ name: m })),
        dimensions: (params.dimensions || []).map((d) => ({ name: d })),
      };
      if (params.limit) body.limit = String(params.limit);
      return gaApi('POST', `/v1beta/properties/${creds.property_id}:runRealtimeReport`, creds.access_token, body);
    },
    list_properties: async (params, creds) => {
      const accountId = params.account_id || '';
      return gaAdminApi('GET', `/v1beta/properties?filter=parent:accounts/${accountId}`, creds.access_token);
    },
    get_metadata: async (params, creds) => gaApi('GET', `/v1beta/properties/${creds.property_id}/metadata`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
