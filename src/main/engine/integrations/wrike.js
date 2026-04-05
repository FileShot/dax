/**
 * Wrike API Integration
 */
'use strict';
const https = require('https');

function wrikeApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'www.wrike.com', path: `/api/v4${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'wrike',
  name: 'Wrike',
  category: 'project-management',
  icon: 'LayoutGrid',
  description: 'Manage projects, folders, and tasks in Wrike.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wrikeApi('GET', '/profile', creds.access_token); return { success: !!r.data?.[0]?.id, message: `Connected as ${r.data?.[0]?.profile?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_folders: async (params, creds) => {
      const qs = params.folder_id ? '' : '';
      const path = params.folder_id ? `/folders/${params.folder_id}/folders` : '/folders';
      return wrikeApi('GET', path, creds.access_token);
    },
    list_tasks: async (params, creds) => {
      const qs = new URLSearchParams({ sortField: 'UPDATED_DATE', sortOrder: 'Desc', limit: params.limit || 50 });
      if (params.folder_id) return wrikeApi('GET', `/folders/${params.folder_id}/tasks?${qs}`, creds.access_token);
      return wrikeApi('GET', `/tasks?${qs}`, creds.access_token);
    },
    get_task: async (params, creds) => { if (!params.task_id) throw new Error('task_id required'); return wrikeApi('GET', `/tasks/${params.task_id}`, creds.access_token); },
    create_task: async (params, creds) => {
      if (!params.folder_id || !params.title) throw new Error('folder_id and title required');
      return wrikeApi('POST', `/folders/${params.folder_id}/tasks`, creds.access_token, { title: params.title, description: params.description || '', status: params.status || 'Active', importance: params.importance || 'Normal' });
    },
    update_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      const body = {};
      if (params.title) body.title = params.title;
      if (params.status) body.status = params.status;
      if (params.description) body.description = params.description;
      return wrikeApi('PUT', `/tasks/${params.task_id}`, creds.access_token, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
