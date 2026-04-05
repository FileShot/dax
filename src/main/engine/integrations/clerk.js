/**
 * Clerk API Integration
 */
'use strict';
const https = require('https');

function clerkApi(method, path, secretKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.clerk.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' } };
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
  id: 'clerk',
  name: 'Clerk',
  category: 'auth',
  icon: 'UserCog',
  description: 'Manage users, sessions, and organizations with Clerk.',
  configFields: [
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.secret_key) throw new Error('Secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await clerkApi('GET', '/users?limit=1', creds.secret_key); return { success: Array.isArray(r), message: 'Connected to Clerk' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_users: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 50, offset: params.offset || 0 });
      if (params.email_address) qs.set('email_address', params.email_address);
      return clerkApi('GET', `/users?${qs}`, creds.secret_key);
    },
    get_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return clerkApi('GET', `/users/${params.user_id}`, creds.secret_key); },
    create_user: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return clerkApi('POST', '/users', creds.secret_key, { email_address: [params.email], password: params.password || undefined, first_name: params.first_name || '', last_name: params.last_name || '', public_metadata: params.metadata || {} });
    },
    delete_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return clerkApi('DELETE', `/users/${params.user_id}`, creds.secret_key); },
    list_sessions: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 50 });
      if (params.user_id) qs.set('user_id', params.user_id);
      if (params.status) qs.set('status', params.status);
      return clerkApi('GET', `/sessions?${qs}`, creds.secret_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
