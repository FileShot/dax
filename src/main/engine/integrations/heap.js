/**
 * Heap Analytics Integration
 */
'use strict';
const https = require('https');

function heapReq(method, path, appId, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'heapanalytics.com', path: `/api${path}`,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Heap-App-Id': appId, 'X-Heap-Api-Key': apiKey, ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
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
  id: 'heap',
  name: 'Heap Analytics',
  category: 'analytics',
  icon: 'PieChart',
  description: 'Access Heap Analytics user and event data, and send server-side events.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.api_key) throw new Error('App ID and API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await heapReq('POST', '/track', creds.app_id, creds.api_key, { app_id: creds.app_id, events: [] });
      if (r.error) return { success: false, message: r.error };
      return { success: true, message: 'Connected to Heap Analytics' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_event: async (params, creds) => {
      if (!params.identity || !params.event) throw new Error('identity and event name required');
      return heapReq('POST', '/track', creds.app_id, creds.api_key, { app_id: creds.app_id, events: [{ identity: params.identity, event: params.event, timestamp: params.timestamp || new Date().toISOString(), properties: params.properties || {} }] });
    },
    add_user_properties: async (params, creds) => {
      if (!params.identity) throw new Error('identity required');
      return heapReq('POST', '/add_user_properties', creds.app_id, creds.api_key, { app_id: creds.app_id, identity: params.identity, properties: params.properties || {} });
    },
    delete_user: async (params, creds) => {
      if (!params.identity) throw new Error('identity required');
      return heapReq('POST', '/delete_user', creds.app_id, creds.api_key, { app_id: creds.app_id, identity: params.identity });
    },
    get_definitions: async (_params, creds) => {
      return heapReq('GET', '/definition/event', creds.app_id, creds.api_key);
    },
    list_segments: async (_params, creds) => {
      return heapReq('GET', `/definition/segment?app_id=${creds.app_id}`, creds.app_id, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
