/**
 * Splunk REST API Integration
 */
'use strict';
const https = require('https');

function splunkApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: undefined, port: 8089, path: `/services${path}?output_mode=json`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' }, rejectUnauthorized: false };
    // hostname set at call time via closure
    opts.__host = true;
    const req = https.request({ ...opts, hostname: opts._hostname }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : new URLSearchParams(body).toString());
    req.end();
  });
}

function splunkRequest(method, host, port, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const isForm = method === 'POST' && body && typeof body === 'object';
    const bodyStr = isForm ? new URLSearchParams(body).toString() : (body ? JSON.stringify(body) : null);
    const opts = {
      method, hostname: host, port: port || 8089,
      path: `${path}${path.includes('?') ? '&' : '?'}output_mode=json`,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json' },
      rejectUnauthorized: false,
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
  id: 'splunk',
  name: 'Splunk',
  category: 'logging',
  icon: 'BarChart',
  description: 'Search logs, run SPL queries, and monitor alerts in Splunk.',
  configFields: [
    { key: 'host', label: 'Splunk Host', type: 'text', required: true, placeholder: 'your-splunk.example.com' },
    { key: 'port', label: 'REST API Port', type: 'number', required: false, placeholder: '8089' },
    { key: 'token', label: 'Bearer Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.host || !creds.token) throw new Error('Host and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await splunkRequest('GET', creds.host, creds.port, '/services/server/info', creds.token); return { success: !!r.entry, message: `Splunk ${r.entry?.[0]?.content?.version || ''} connected` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.search) throw new Error('search (SPL query) required');
      const body = { search: params.search.startsWith('search') ? params.search : `search ${params.search}`, output_mode: 'json', count: params.count || 100 };
      if (params.earliest_time) body.earliest_time = params.earliest_time;
      if (params.latest_time) body.latest_time = params.latest_time;
      return splunkRequest('POST', creds.host, creds.port, '/services/search/jobs/oneshot', creds.token, body);
    },
    list_indexes: async (params, creds) => splunkRequest('GET', creds.host, creds.port, '/services/data/indexes', creds.token),
    list_saved_searches: async (params, creds) => splunkRequest('GET', creds.host, creds.port, '/services/saved/searches', creds.token),
    get_job_results: async (params, creds) => { if (!params.job_id) throw new Error('job_id required'); return splunkRequest('GET', creds.host, creds.port, `/services/search/jobs/${params.job_id}/results`, creds.token); },
    list_alerts: async (params, creds) => splunkRequest('GET', creds.host, creds.port, '/services/alerts/fired_alerts', creds.token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
