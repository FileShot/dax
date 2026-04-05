/**
 * Auth0 Management API Integration
 */
'use strict';
const https = require('https');

function a0Api(method, path, domain, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: domain, path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'auth0',
  name: 'Auth0',
  category: 'auth',
  icon: 'Shield',
  description: 'Manage users, roles, and applications via Auth0 Management API.',
  configFields: [
    { key: 'domain', label: 'Domain (e.g. yourapp.auth0.com)', type: 'text', required: true },
    { key: 'management_token', label: 'Management API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.domain || !creds.management_token) throw new Error('Domain and management token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await a0Api('GET', '/tenants/settings', creds.domain, creds.management_token); return { success: !!r.friendly_name, message: `Connected to ${r.friendly_name || creds.domain}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_users: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 0, include_totals: 'true' });
      if (params.q) qs.set('q', params.q);
      return a0Api('GET', `/users?${qs}`, creds.domain, creds.management_token);
    },
    get_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return a0Api('GET', `/users/${encodeURIComponent(params.user_id)}`, creds.domain, creds.management_token); },
    create_user: async (params, creds) => {
      if (!params.email || !params.password || !params.connection) throw new Error('email, password, and connection required');
      return a0Api('POST', '/users', creds.domain, creds.management_token, { email: params.email, password: params.password, connection: params.connection, name: params.name || '', blocked: false });
    },
    delete_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return a0Api('DELETE', `/users/${encodeURIComponent(params.user_id)}`, creds.domain, creds.management_token); },
    get_stats: async (params, creds) => a0Api('GET', `/stats/active-users`, creds.domain, creds.management_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
