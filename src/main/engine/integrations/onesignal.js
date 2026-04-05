/**
 * OneSignal Push Notification Integration
 */
'use strict';
const https = require('https');

function oneSignalRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'onesignal.com', path, headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'onesignal',
  name: 'OneSignal',
  category: 'notifications',
  icon: 'BellRing',
  description: 'Send and manage push notifications with OneSignal.',
  configFields: [
    { key: 'api_key', label: 'REST API Key', type: 'password', required: true },
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.app_id) throw new Error('API key and app ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await oneSignalRequest('GET', `/api/v1/apps/${creds.app_id}`, null, creds.api_key); return { success: !!r.id, message: r.errors ? r.errors[0] : 'Connected to OneSignal' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_notification: async (params, creds) => {
      if (!params.contents && !params.template_id) throw new Error('contents or template_id required');
      const body = { app_id: creds.app_id, contents: params.contents || { en: '' }, ...(params.included_segments && { included_segments: params.included_segments }), ...(params.include_player_ids && { include_player_ids: params.include_player_ids }), ...(params.headings && { headings: params.headings }), ...(params.url && { url: params.url }), ...(params.template_id && { template_id: params.template_id }) };
      return oneSignalRequest('POST', '/api/v1/notifications', body, creds.api_key);
    },
    list_notifications: async (params, creds) => {
      const limit = params.limit || 20;
      const offset = params.offset || 0;
      return oneSignalRequest('GET', `/api/v1/notifications?app_id=${creds.app_id}&limit=${limit}&offset=${offset}`, null, creds.api_key);
    },
    get_notification: async (params, creds) => {
      if (!params.notification_id) throw new Error('notification_id required');
      return oneSignalRequest('GET', `/api/v1/notifications/${params.notification_id}?app_id=${creds.app_id}`, null, creds.api_key);
    },
    cancel_notification: async (params, creds) => {
      if (!params.notification_id) throw new Error('notification_id required');
      return oneSignalRequest('DELETE', `/api/v1/notifications/${params.notification_id}?app_id=${creds.app_id}`, null, creds.api_key);
    },
    view_devices: async (params, creds) => {
      const limit = params.limit || 20;
      return oneSignalRequest('GET', `/api/v1/players?app_id=${creds.app_id}&limit=${limit}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
