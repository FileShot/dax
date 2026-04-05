/**
 * Firebase Auth REST API Integration
 */
'use strict';
const https = require('https');

function fbAuthApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method, hostname: 'identitytoolkit.googleapis.com', path: `/v1${path}${sep}key=${apiKey}`, headers: { 'Content-Type': 'application/json' } };
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

function fbAuthAdmin(method, path, projectId, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'identitytoolkit.googleapis.com', path: `/v1/projects/${projectId}${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'firebase-auth',
  name: 'Firebase Auth',
  category: 'auth',
  icon: 'KeyRound',
  description: 'Manage Firebase Authentication users and sign-in methods.',
  configFields: [
    { key: 'api_key', label: 'Web API Key', type: 'password', required: true },
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
    { key: 'admin_token', label: 'Admin OAuth Token (for user management)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.api_key || !creds.project_id) throw new Error('API key and project ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { if (!creds.api_key) throw new Error('No credentials'); return { success: true, message: 'Firebase Auth configured' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    sign_in_with_email: async (params, creds) => {
      if (!params.email || !params.password) throw new Error('email and password required');
      return fbAuthApi('POST', '/accounts:signInWithPassword', creds.api_key, { email: params.email, password: params.password, returnSecureToken: true });
    },
    create_user: async (params, creds) => {
      if (!params.email || !params.password) throw new Error('email and password required');
      return fbAuthApi('POST', '/accounts:signUp', creds.api_key, { email: params.email, password: params.password, displayName: params.display_name || '', returnSecureToken: true });
    },
    get_user: async (params, creds) => {
      if (!params.id_token) throw new Error('id_token required');
      return fbAuthApi('POST', '/accounts:lookup', creds.api_key, { idToken: params.id_token });
    },
    list_users: async (params, creds) => {
      if (!creds.admin_token) throw new Error('admin_token required for listing users');
      return fbAuthAdmin('POST', '/accounts:query', creds.project_id, creds.admin_token, { returnUserInfo: true });
    },
    send_password_reset: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return fbAuthApi('POST', '/accounts:sendOobCode', creds.api_key, { requestType: 'PASSWORD_RESET', email: params.email });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
