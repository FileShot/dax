/**
 * Okta Identity & Access Management Integration
 */
'use strict';
const https = require('https');

function oktaApi(method, domain, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: domain, path: `/api/v1${path}`, headers: { 'Authorization': `SSWS ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'okta',
  name: 'Okta',
  category: 'security',
  icon: 'UserCheck',
  description: 'Manage users, groups, and applications in Okta.',
  configFields: [
    { key: 'domain', label: 'Okta Domain', type: 'text', required: true, placeholder: 'dev-12345.okta.com' },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.domain || !creds.api_token) throw new Error('Domain and API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await oktaApi('GET', creds.domain, '/users?limit=1', creds.api_token); return { success: Array.isArray(r), message: Array.isArray(r) ? 'Connected to Okta' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_users: async (params, creds) => oktaApi('GET', creds.domain, `/users?limit=${params.limit || 25}${params.query ? `&q=${encodeURIComponent(params.query)}` : ''}`, creds.api_token),
    get_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return oktaApi('GET', creds.domain, `/users/${params.user_id}`, creds.api_token); },
    list_groups: async (params, creds) => oktaApi('GET', creds.domain, `/groups?limit=${params.limit || 25}`, creds.api_token),
    list_apps: async (params, creds) => oktaApi('GET', creds.domain, `/apps?limit=${params.limit || 25}`, creds.api_token),
    deactivate_user: async (params, creds) => { if (!params.user_id) throw new Error('user_id required'); return oktaApi('POST', creds.domain, `/users/${params.user_id}/lifecycle/deactivate`, creds.api_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
