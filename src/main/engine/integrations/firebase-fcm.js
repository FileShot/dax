/**
 * Firebase Cloud Messaging (FCM) v1 Integration
 */
'use strict';
const https = require('https');

function fcmRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'fcm.googleapis.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'firebase-fcm',
  name: 'Firebase FCM',
  category: 'notifications',
  icon: 'Bell',
  description: 'Send push notifications via Firebase Cloud Messaging v1 API.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'project_id', label: 'Firebase Project ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.project_id) throw new Error('Access token and project ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fcmRequest('GET', `/v1/projects/${creds.project_id}/messages`, null, creds.access_token); return { success: !r.error, message: r.error ? r.error.message : 'Connected to Firebase FCM' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_notification: async (params, creds) => {
      if (!params.token && !params.topic && !params.condition) throw new Error('token, topic, or condition required');
      const msg = { message: { notification: params.notification || {}, ...(params.token && { token: params.token }), ...(params.topic && { topic: params.topic }), ...(params.data && { data: params.data }) } };
      return fcmRequest('POST', `/v1/projects/${creds.project_id}/messages:send`, msg, creds.access_token);
    },
    send_multicast: async (params, creds) => {
      if (!params.tokens || !Array.isArray(params.tokens)) throw new Error('tokens array required');
      const results = [];
      for (const tok of params.tokens) {
        const r = await fcmRequest('POST', `/v1/projects/${creds.project_id}/messages:send`, { message: { token: tok, notification: params.notification || {}, ...(params.data && { data: params.data }) } }, creds.access_token);
        results.push({ token: tok, result: r });
      }
      return { results };
    },
    subscribe_to_topic: async (params, creds) => {
      if (!params.tokens || !params.topic) throw new Error('tokens and topic required');
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({ to: `/topics/${params.topic}`, registration_tokens: params.tokens });
        const opts = { method: 'POST', hostname: 'iid.googleapis.com', path: '/iid/v1:batchAdd', headers: { 'Authorization': `Bearer ${creds.access_token}`, 'access_token_auth': 'true', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    },
    send_to_topic: async (params, creds) => {
      if (!params.topic) throw new Error('topic required');
      return fcmRequest('POST', `/v1/projects/${creds.project_id}/messages:send`, { message: { topic: params.topic, notification: params.notification || {}, ...(params.data && { data: params.data }) } }, creds.access_token);
    },
    send_data_message: async (params, creds) => {
      if (!params.token) throw new Error('token required');
      return fcmRequest('POST', `/v1/projects/${creds.project_id}/messages:send`, { message: { token: params.token, data: params.data || {} } }, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
