/**
 * Novu Notification Infrastructure Integration
 */
'use strict';
const https = require('https');

function novuRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.novu.co', path, headers: { 'Authorization': `ApiKey ${apiKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'novu',
  name: 'Novu',
  category: 'notifications',
  icon: 'Megaphone',
  description: 'Send multi-channel notifications via Novu open-source notification infrastructure.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await novuRequest('GET', '/v1/subscribers?page=0&limit=1', null, creds.api_key); return { success: r.data !== undefined, message: r.message || 'Connected to Novu' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    trigger_event: async (params, creds) => {
      if (!params.name || !params.to) throw new Error('name and to required');
      const body = { name: params.name, to: params.to, payload: params.payload || {}, ...(params.overrides && { overrides: params.overrides }), ...(params.transaction_id && { transactionId: params.transaction_id }) };
      return novuRequest('POST', '/v1/events/trigger', body, creds.api_key);
    },
    create_subscriber: async (params, creds) => {
      if (!params.subscriber_id) throw new Error('subscriber_id required');
      const body = { subscriberId: params.subscriber_id, ...(params.email && { email: params.email }), ...(params.first_name && { firstName: params.first_name }), ...(params.last_name && { lastName: params.last_name }), ...(params.phone && { phone: params.phone }), ...(params.avatar && { avatar: params.avatar }), ...(params.data && { data: params.data }) };
      return novuRequest('POST', '/v1/subscribers', body, creds.api_key);
    },
    get_subscriber: async (params, creds) => {
      if (!params.subscriber_id) throw new Error('subscriber_id required');
      return novuRequest('GET', `/v1/subscribers/${params.subscriber_id}`, null, creds.api_key);
    },
    update_subscriber: async (params, creds) => {
      if (!params.subscriber_id) throw new Error('subscriber_id required');
      const body = { ...(params.email && { email: params.email }), ...(params.first_name && { firstName: params.first_name }), ...(params.last_name && { lastName: params.last_name }), ...(params.phone && { phone: params.phone }), ...(params.data && { data: params.data }) };
      return novuRequest('PUT', `/v1/subscribers/${params.subscriber_id}`, body, creds.api_key);
    },
    list_notifications: async (params, creds) => {
      const page = params.page || 0;
      const limit = params.limit || 20;
      return novuRequest('GET', `/v1/notifications?page=${page}&limit=${limit}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
