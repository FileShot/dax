/**
 * PostHog Product Analytics Integration
 */
'use strict';
const https = require('https');

function posthogReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'app.posthog.com', path: `/api${path}`,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'posthog',
  name: 'PostHog',
  category: 'analytics',
  icon: 'BarChart2',
  description: 'Access PostHog product analytics events, insights, persons, and feature flags.',
  configFields: [
    { key: 'api_key', label: 'Personal API Key', type: 'password', required: true },
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.project_id) throw new Error('Personal API key and project ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await posthogReq('GET', `/projects/${creds.project_id}/`, creds.api_key); if (r.detail) return { success: false, message: r.detail }; return { success: true, message: `Connected to project: ${r.name || creds.project_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_events: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 50), ...(params.event && { event: params.event }), ...(params.after && { after: params.after }), ...(params.before && { before: params.before }) }).toString();
      return posthogReq('GET', `/projects/${creds.project_id}/events/?${qs}`, creds.api_key);
    },
    get_insights: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.saved && { saved: 'true' }) }).toString();
      return posthogReq('GET', `/projects/${creds.project_id}/insights/?${qs}`, creds.api_key);
    },
    list_persons: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.search && { search: params.search }) }).toString();
      return posthogReq('GET', `/projects/${creds.project_id}/persons/?${qs}`, creds.api_key);
    },
    get_person: async (params, creds) => {
      if (!params.person_id) throw new Error('person_id required');
      return posthogReq('GET', `/projects/${creds.project_id}/persons/${params.person_id}/`, creds.api_key);
    },
    list_feature_flags: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20) }).toString();
      return posthogReq('GET', `/projects/${creds.project_id}/feature_flags/?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
