/**
 * Supabase Auth Admin API Integration
 */
'use strict';
const https = require('https');

function sbAuthApi(method, path, projectRef, serviceKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `${projectRef}.supabase.co`, path: `/auth/v1${path}`, headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' } };
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
  id: 'supabase-auth',
  name: 'Supabase Auth',
  category: 'auth',
  icon: 'UserCheck',
  description: 'Manage users and authentication with Supabase Auth Admin API.',
  configFields: [
    { key: 'project_ref', label: 'Project Reference ID', type: 'text', required: true },
    { key: 'service_key', label: 'Service Role Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.project_ref || !creds.service_key) throw new Error('Project reference and service key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sbAuthApi('GET', '/admin/users?page=1&per_page=1', creds.project_ref, creds.service_key); return { success: r.users !== undefined, message: `${r.total || 0} total user(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_users: async (params, creds) => {
      const qs = new URLSearchParams({ page: params.page || 1, per_page: params.per_page || 50 });
      return sbAuthApi('GET', `/admin/users?${qs}`, creds.project_ref, creds.service_key);
    },
    get_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return sbAuthApi('GET', `/admin/users/${params.user_id}`, creds.project_ref, creds.service_key); },
    create_user: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return sbAuthApi('POST', '/admin/users', creds.project_ref, creds.service_key, { email: params.email, password: params.password || '', email_confirm: params.email_confirm !== false, user_metadata: params.metadata || {} });
    },
    delete_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return sbAuthApi('DELETE', `/admin/users/${params.user_id}`, creds.project_ref, creds.service_key); },
    invite_user: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return sbAuthApi('POST', '/admin/invite', creds.project_ref, creds.service_key, { email: params.email, data: params.data || {} });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
