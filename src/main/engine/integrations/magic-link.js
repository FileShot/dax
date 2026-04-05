/**
 * Magic.link (Passwordless Auth) API Integration
 */
'use strict';
const https = require('https');

function magicApi(method, path, secretKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.magic.link', path, headers: { 'X-Magic-Secret-Key': secretKey, 'Content-Type': 'application/json' } };
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
  id: 'magic-link',
  name: 'Magic',
  category: 'auth',
  icon: 'Wand',
  description: 'Manage passwordless authentication with Magic.link.',
  configFields: [
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.secret_key) throw new Error('Secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await magicApi('GET', '/v1/admin/auth/user/get?page_size=1&page_token=0', creds.secret_key); return { success: r.status === 'ok', message: 'Connected to Magic' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user_info: async (params, creds) => {
      if (!params.issuer && !params.email) throw new Error('issuer or email required');
      const qs = params.issuer ? `issuer=${encodeURIComponent(params.issuer)}` : `email=${encodeURIComponent(params.email)}`;
      return magicApi('GET', `/v1/admin/auth/user/get?${qs}`, creds.secret_key);
    },
    list_users: async (params, creds) => {
      const qs = new URLSearchParams({ page_size: params.page_size || 20, page_token: params.page_token || 0 });
      return magicApi('GET', `/v1/admin/auth/user/get?${qs}`, creds.secret_key);
    },
    logout_user: async (params, creds) => {
      if (!params.issuer) throw new Error('issuer required');
      return magicApi('POST', '/v2/admin/auth/user/logout', creds.secret_key, { issuer: params.issuer });
    },
    get_metadata: async (params, creds) => {
      if (!params.issuer) throw new Error('issuer required');
      return magicApi('GET', `/v1/admin/auth/user/get?issuer=${encodeURIComponent(params.issuer)}`, creds.secret_key);
    },
    issue_token: async (params, creds) => {
      if (!params.issuer) throw new Error('issuer required');
      return magicApi('POST', '/v2/admin/auth/user/generate-temporary-login', creds.secret_key, { issuer: params.issuer, access_type: 'magic_link' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
