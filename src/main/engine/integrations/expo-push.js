/**
 * Expo Push Notifications Integration
 */
'use strict';
const https = require('https');

function expoRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }), ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) };
    const opts = { method, hostname: 'exp.host', path, headers };
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
  id: 'expo-push',
  name: 'Expo Push',
  category: 'notifications',
  icon: 'Smartphone',
  description: 'Send push notifications to Expo-managed React Native apps.',
  configFields: [
    { key: 'access_token', label: 'Access Token (optional)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await expoRequest('POST', '/--/api/v2/push/getReceipts', { ids: [] }, creds.access_token || null);
      return { success: !!r.data, message: 'Connected to Expo Push API' };
    }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_push: async (params, creds) => {
      if (!params.to) throw new Error('to (Expo push token) required');
      const messages = Array.isArray(params.to)
        ? params.to.map(tok => ({ to: tok, title: params.title, body: params.body || '', ...(params.data && { data: params.data }), ...(params.sound !== undefined && { sound: params.sound }), ...(params.badge !== undefined && { badge: params.badge }) }))
        : [{ to: params.to, title: params.title, body: params.body || '', ...(params.data && { data: params.data }) }];
      return expoRequest('POST', '/--/api/v2/push/send', messages, creds.access_token || null);
    },
    check_receipts: async (params, creds) => {
      if (!params.ids || !Array.isArray(params.ids)) throw new Error('ids array required');
      return expoRequest('POST', '/--/api/v2/push/getReceipts', { ids: params.ids }, creds.access_token || null);
    },
    send_to_multiple: async (params, creds) => {
      if (!params.tokens || !Array.isArray(params.tokens)) throw new Error('tokens array required');
      const messages = params.tokens.map(tok => ({ to: tok, title: params.title, body: params.body || '', ...(params.data && { data: params.data }) }));
      return expoRequest('POST', '/--/api/v2/push/send', messages, creds.access_token || null);
    },
    validate_token: async (params, creds) => {
      if (!params.token) throw new Error('token required');
      const isValid = typeof params.token === 'string' && (params.token.startsWith('ExponentPushToken[') || params.token.startsWith('ExpoPushToken['));
      return { valid: isValid, token: params.token };
    },
    check_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      return expoRequest('POST', '/--/api/v2/push/getReceipts', { ids: [params.ticket_id] }, creds.access_token || null);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
