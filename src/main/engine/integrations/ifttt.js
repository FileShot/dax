/**
 * IFTTT Webhooks Integration
 */
'use strict';
const https = require('https');

function iftttApi(eventName, key, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = { method: 'POST', hostname: 'maker.ifttt.com', path: `/trigger/${encodeURIComponent(eventName)}/with/key/${key}`, headers: { 'Content-Type': 'application/json' } };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ success: res.statusCode === 200, statusCode: res.statusCode, message: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = {
  id: 'ifttt',
  name: 'IFTTT',
  category: 'iot',
  icon: 'Zap',
  description: 'Trigger IFTTT applets via Webhooks service.',
  configFields: [
    { key: 'webhook_key', label: 'Webhooks Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.webhook_key) throw new Error('Webhooks key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await iftttApi('dax_test', creds.webhook_key); return { success: r.statusCode === 200 || r.statusCode === 401, message: r.statusCode === 200 ? 'Connected to IFTTT' : 'Key may be invalid' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    trigger_event: async (params, creds) => {
      if (!params.event) throw new Error('event name required');
      const body = {};
      if (params.value1 !== undefined) body.value1 = params.value1;
      if (params.value2 !== undefined) body.value2 = params.value2;
      if (params.value3 !== undefined) body.value3 = params.value3;
      return iftttApi(params.event, creds.webhook_key, Object.keys(body).length > 0 ? body : null);
    },
    trigger_with_json: async (params, creds) => {
      if (!params.event || !params.data) throw new Error('event and data required');
      return iftttApi(params.event, creds.webhook_key, params.data);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
