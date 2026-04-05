/**
 * Canva Connect API Integration
 */
'use strict';
const https = require('https');

function canvaApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.canva.com', path: `/rest/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'canva',
  name: 'Canva',
  category: 'design',
  icon: 'Palette',
  description: 'Manage designs and assets in Canva.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await canvaApi('GET', '/users/me', creds.access_token); return { success: !!r.profile, message: r.profile ? `Connected as ${r.profile.display_name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_designs: async (params, creds) => canvaApi('GET', `/designs?limit=${params.limit || 20}`, creds.access_token),
    get_design: async (params, creds) => { if (!params.design_id) throw new Error('design_id required'); return canvaApi('GET', `/designs/${params.design_id}`, creds.access_token); },
    create_design: async (params, creds) => {
      if (!params.design_type) throw new Error('design_type required');
      return canvaApi('POST', '/designs', creds.access_token, { design_type: { type: params.design_type }, title: params.title });
    },
    list_folders: async (params, creds) => canvaApi('GET', `/folders?limit=${params.limit || 20}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
