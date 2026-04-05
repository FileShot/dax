/**
 * Clio Legal Practice Management Integration
 */
'use strict';
const https = require('https');

function clioReq(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'app.clio.com', path: `/api/v4${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'clio',
  name: 'Clio',
  category: 'legal',
  icon: 'Briefcase',
  description: 'Manage Clio legal practice matters, contacts, documents, and time entries.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await clioReq('GET', '/users/who_am_i.json', creds.access_token); if (r.error) return { success: false, message: r.error }; return { success: true, message: `Connected as ${r.data?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (_p, creds) => clioReq('GET', '/users/who_am_i.json', creds.access_token),
    list_matters: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 25), ...(params.status && { status: params.status }), ...(params.query && { query: params.query }) }).toString();
      return clioReq('GET', `/matters.json?${qs}`, creds.access_token);
    },
    get_matter: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return clioReq('GET', `/matters/${params.id}.json`, creds.access_token);
    },
    list_contacts: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 25), ...(params.query && { query: params.query }) }).toString();
      return clioReq('GET', `/contacts.json?${qs}`, creds.access_token);
    },
    list_documents: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 25), ...(params.matter_id && { matter_id: String(params.matter_id) }) }).toString();
      return clioReq('GET', `/documents.json?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
