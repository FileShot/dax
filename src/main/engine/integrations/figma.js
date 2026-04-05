/**
 * Figma API Integration
 */
'use strict';
const https = require('https');

function figmaApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.figma.com', path: `/v1${path}`, headers: { 'X-Figma-Token': token, 'Content-Type': 'application/json' } };
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
  id: 'figma',
  name: 'Figma',
  category: 'design',
  icon: 'Figma',
  description: 'Access Figma files, components, and comments.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await figmaApi('GET', '/me', creds.access_token); return { success: !!r.id, message: r.handle ? `Connected as ${r.handle}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_file: async (params, creds) => { if (!params.file_key) throw new Error('file_key required'); return figmaApi('GET', `/files/${params.file_key}`, creds.access_token); },
    get_file_nodes: async (params, creds) => {
      if (!params.file_key || !params.node_ids) throw new Error('file_key and node_ids required');
      const ids = Array.isArray(params.node_ids) ? params.node_ids.join(',') : params.node_ids;
      return figmaApi('GET', `/files/${params.file_key}/nodes?ids=${encodeURIComponent(ids)}`, creds.access_token);
    },
    get_comments: async (params, creds) => { if (!params.file_key) throw new Error('file_key required'); return figmaApi('GET', `/files/${params.file_key}/comments`, creds.access_token); },
    post_comment: async (params, creds) => { if (!params.file_key || !params.message) throw new Error('file_key and message required'); return figmaApi('POST', `/files/${params.file_key}/comments`, creds.access_token, { message: params.message }); },
    get_team_projects: async (params, creds) => { if (!params.team_id) throw new Error('team_id required'); return figmaApi('GET', `/teams/${params.team_id}/projects`, creds.access_token); },
    get_project_files: async (params, creds) => { if (!params.project_id) throw new Error('project_id required'); return figmaApi('GET', `/projects/${params.project_id}/files`, creds.access_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
