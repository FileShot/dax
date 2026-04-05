/**
 * Pushover Notification Integration
 */
'use strict';
const https = require('https');

function pushoverApi(params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const opts = { method: 'POST', hostname: 'api.pushover.net', path: '/1/messages.json', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'pushover',
  name: 'Pushover',
  category: 'communication',
  icon: 'BellRing',
  description: 'Send push notifications via Pushover.',
  configFields: [
    { key: 'api_token', label: 'Application API Token', type: 'password', required: true },
    { key: 'user_key', label: 'User Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token || !creds.user_key) throw new Error('API token and user key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const body = new URLSearchParams({ token: creds.api_token, user: creds.user_key }).toString();
      return new Promise((resolve, reject) => {
        const req = https.request({ method: 'POST', hostname: 'api.pushover.net', path: '/1/users/validate.json', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => { try { const j = JSON.parse(data); resolve({ success: j.status === 1, message: j.status === 1 ? 'Credentials valid' : j.errors?.join(', ') || 'Invalid' }); } catch { resolve({ success: false, message: 'Parse error' }); } });
        });
        req.on('error', (e) => resolve({ success: false, message: e.message }));
        req.write(body);
        req.end();
      });
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_notification: async (params, creds) => {
      if (!params.message) throw new Error('message required');
      const body = { token: creds.api_token, user: creds.user_key, message: params.message };
      if (params.title) body.title = params.title;
      if (params.priority !== undefined) body.priority = params.priority; // -2 to 2
      if (params.sound) body.sound = params.sound;
      if (params.url) body.url = params.url;
      if (params.url_title) body.url_title = params.url_title;
      if (params.device) body.device = params.device;
      if (params.html) body.html = 1;
      if (params.priority === 2) { body.retry = params.retry || 60; body.expire = params.expire || 3600; }
      return pushoverApi(body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
