/**
 * Amplitude Analytics Integration
 */
'use strict';
const https = require('https');

function ampApi(method, hostname, path, headers, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path, headers: { 'Content-Type': 'application/json', ...headers } };
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
  id: 'amplitude',
  name: 'Amplitude',
  category: 'analytics',
  icon: 'Activity',
  description: 'Track events and analyze product usage with Amplitude.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.secret_key) throw new Error('API key and secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const auth = Buffer.from(`${creds.api_key}:${creds.secret_key}`).toString('base64');
      const r = await ampApi('GET', 'amplitude.com', '/api/2/events/segmentation?e={"event_type":"_active"}&start=20240101&end=20240102', { 'Authorization': `Basic ${auth}` });
      return { success: true, message: 'Connected to Amplitude' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    track_events: async (params, creds) => {
      if (!params.events || !Array.isArray(params.events)) throw new Error('events array required');
      return ampApi('POST', 'api2.amplitude.com', '/2/httpapi', { 'Content-Type': 'application/json' }, { api_key: creds.api_key, events: params.events });
    },
    get_user_activity: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const auth = Buffer.from(`${creds.api_key}:${creds.secret_key}`).toString('base64');
      return ampApi('GET', 'amplitude.com', `/api/2/useractivity?user=${encodeURIComponent(params.user_id)}&limit=${params.limit || 100}`, { 'Authorization': `Basic ${auth}` });
    },
    segmentation_query: async (params, creds) => {
      if (!params.event_type) throw new Error('event_type required');
      const auth = Buffer.from(`${creds.api_key}:${creds.secret_key}`).toString('base64');
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
      const end = params.end_date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const e = encodeURIComponent(JSON.stringify({ event_type: params.event_type }));
      return ampApi('GET', 'amplitude.com', `/api/2/events/segmentation?e=${e}&start=${start}&end=${end}`, { 'Authorization': `Basic ${auth}` });
    },
    get_active_users: async (params, creds) => {
      const auth = Buffer.from(`${creds.api_key}:${creds.secret_key}`).toString('base64');
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
      const end = params.end_date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return ampApi('GET', 'amplitude.com', `/api/2/users/powerusers?start=${start}&end=${end}&limit=${params.limit || 100}`, { 'Authorization': `Basic ${auth}` });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
