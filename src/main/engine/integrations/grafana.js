/**
 * Grafana API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function grafanaApi(method, baseUrl, path, token, body = null) {
  const url = new URL(baseUrl);
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 3000), path: `/api${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = mod.request(opts, (res) => {
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
  id: 'grafana',
  name: 'Grafana',
  category: 'monitoring',
  icon: 'LineChart',
  description: 'Manage Grafana dashboards, datasources, and alerts.',
  configFields: [
    { key: 'url', label: 'Grafana URL (e.g. https://grafana.example.com)', type: 'text', required: true },
    { key: 'api_key', label: 'API Key / Service Account Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.url || !creds.api_key) throw new Error('URL and API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await grafanaApi('GET', creds.url, '/org', creds.api_key); return { success: !!r.id, message: r.id ? `Connected to org: ${r.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_dashboards: async (params, creds) => grafanaApi('GET', creds.url, `/search?type=dash-db&limit=${params.limit || 20}`, creds.api_key),
    get_dashboard: async (params, creds) => { if (!params.uid) throw new Error('uid required'); return grafanaApi('GET', creds.url, `/dashboards/uid/${params.uid}`, creds.api_key); },
    list_datasources: async (params, creds) => grafanaApi('GET', creds.url, '/datasources', creds.api_key),
    list_alerts: async (params, creds) => grafanaApi('GET', creds.url, `/alerts?state=${params.state || 'all'}`, creds.api_key),
    create_annotation: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      return grafanaApi('POST', creds.url, '/annotations', creds.api_key, { text: params.text, tags: params.tags || [], dashboardUID: params.dashboard_uid, time: params.time || Date.now() });
    },
    get_datasource: async (params, creds) => {
      if (!params.uid) throw new Error('uid required');
      return grafanaApi('GET', creds.url, `/datasources/uid/${params.uid}`, creds.api_key);
    },
    list_folders: async (params, creds) => grafanaApi('GET', creds.url, '/folders', creds.api_key),
    create_folder: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return grafanaApi('POST', creds.url, '/folders', creds.api_key, { title: params.title, ...(params.uid && { uid: params.uid }) });
    },
    list_alert_rules: async (params, creds) => grafanaApi('GET', creds.url, '/v1/provisioning/alert-rules', creds.api_key),
    get_health: async (params, creds) => grafanaApi('GET', creds.url, '/health', creds.api_key),
    list_users: async (params, creds) => grafanaApi('GET', creds.url, `/org/users?perpage=${params.limit || 50}`, creds.api_key),
    list_teams: async (params, creds) => grafanaApi('GET', creds.url, `/teams/search?perpage=${params.limit || 50}`, creds.api_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
