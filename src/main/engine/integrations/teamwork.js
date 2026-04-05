/**
 * Teamwork.com API Integration
 */
'use strict';
const https = require('https');

function twApi(method, path, apiKey, site, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:x`).toString('base64');
    const opts = { method, hostname: `${site}.teamwork.com`, path: `/${path}.json`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'teamwork',
  name: 'Teamwork',
  category: 'project-management',
  icon: 'Users',
  description: 'Manage projects, tasks, and milestones on Teamwork.com.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'site_name', label: 'Site Name (e.g. yourcompany)', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.site_name) throw new Error('API key and site name required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await twApi('GET', 'account', creds.api_key, creds.site_name); return { success: !!r.account?.name, message: `Connected to ${r.account?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => {
      const qs = params.status ? `?status=${params.status}` : '';
      return twApi('GET', `projects${qs}`, creds.api_key, creds.site_name);
    },
    list_tasks: async (params, creds) => {
      if (params.project_id) return twApi('GET', `projects/${params.project_id}/tasks`, creds.api_key, creds.site_name);
      return twApi('GET', 'tasks', creds.api_key, creds.site_name);
    },
    get_task: async (params, creds) => { if (!params.task_id) throw new Error('task_id required'); return twApi('GET', `tasks/${params.task_id}`, creds.api_key, creds.site_name); },
    create_task: async (params, creds) => {
      if (!params.tasklist_id || !params.content) throw new Error('tasklist_id and content required');
      return twApi('POST', `tasklists/${params.tasklist_id}/tasks`, creds.api_key, creds.site_name, { 'todo-item': { content: params.content, description: params.description || '', 'due-date': params.due_date || '' } });
    },
    list_milestones: async (params, creds) => { if (!params.project_id) throw new Error('project_id required'); return twApi('GET', `projects/${params.project_id}/milestones`, creds.api_key, creds.site_name); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
