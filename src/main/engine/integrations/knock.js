/**
 * Knock Notification Infrastructure Integration
 */
'use strict';
const https = require('https');

function knockRequest(method, path, body, secretKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.knock.app', path, headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'knock',
  name: 'Knock',
  category: 'notifications',
  icon: 'BellDot',
  description: 'Send cross-channel notifications via Knock notification infrastructure.',
  configFields: [
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.secret_key) throw new Error('Secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await knockRequest('GET', '/v1/workflows', null, creds.secret_key); return { success: Array.isArray(r.entries) || !!r.items, message: 'Connected to Knock' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    trigger_workflow: async (params, creds) => {
      if (!params.workflow || !params.recipients) throw new Error('workflow and recipients required');
      const body = { recipients: Array.isArray(params.recipients) ? params.recipients : [params.recipients], ...(params.actor && { actor: params.actor }), ...(params.data && { data: params.data }), ...(params.cancellation_key && { cancellation_key: params.cancellation_key }), ...(params.tenant && { tenant: params.tenant }) };
      return knockRequest('POST', `/v1/workflows/${params.workflow}/trigger`, body, creds.secret_key);
    },
    identify_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const body = { ...(params.name && { name: params.name }), ...(params.email && { email: params.email }), ...(params.phone_number && { phone_number: params.phone_number }), ...(params.avatar && { avatar: params.avatar }), ...(params.properties && params.properties) };
      return knockRequest('PUT', `/v1/users/${params.user_id}`, body, creds.secret_key);
    },
    get_user_feed: async (params, creds) => {
      if (!params.user_id || !params.feed_channel_id) throw new Error('user_id and feed_channel_id required');
      const qs = new URLSearchParams({ page_size: String(params.page_size || 20), ...(params.status && { status: params.status }) }).toString();
      return knockRequest('GET', `/v1/users/${params.user_id}/feeds/${params.feed_channel_id}?${qs}`, null, creds.secret_key);
    },
    cancel_workflow: async (params, creds) => {
      if (!params.workflow || !params.cancellation_key) throw new Error('workflow and cancellation_key required');
      const body = { cancellation_key: params.cancellation_key, ...(params.recipients && { recipients: params.recipients }) };
      return knockRequest('DELETE', `/v1/workflows/${params.workflow}/trigger`, body, creds.secret_key);
    },
    bulk_identify_users: async (params, creds) => {
      if (!params.users || !Array.isArray(params.users)) throw new Error('users array required');
      return knockRequest('POST', '/v1/users/bulk/identify', { users: params.users }, creds.secret_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
