/**
 * Basecamp 3 API Integration
 */
'use strict';
const https = require('https');

function bcApi(method, path, token, accountId, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'basecamp.com', path: `/${accountId}/api/v1${path}.json`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'Dax Integration (contact@example.com)' } };
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
  id: 'basecamp',
  name: 'Basecamp',
  category: 'project-management',
  icon: 'Mountain',
  description: 'Manage projects, to-dos, and messages in Basecamp 3.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.account_id) throw new Error('Access token and account ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bcApi('GET', '/projects', creds.access_token, creds.account_id); return { success: Array.isArray(r), message: `Found ${r.length} project(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => bcApi('GET', '/projects', creds.access_token, creds.account_id),
    get_project: async (params, creds) => { if (!params.project_id) throw new Error('project_id required'); return bcApi('GET', `/projects/${params.project_id}`, creds.access_token, creds.account_id); },
    list_todolists: async (params, creds) => { if (!params.project_id) throw new Error('project_id required'); return bcApi('GET', `/buckets/${params.project_id}/todolists`, creds.access_token, creds.account_id); },
    list_todos: async (params, creds) => { if (!params.project_id || !params.todolist_id) throw new Error('project_id and todolist_id required'); return bcApi('GET', `/buckets/${params.project_id}/todolists/${params.todolist_id}/todos`, creds.access_token, creds.account_id); },
    create_todo: async (params, creds) => {
      if (!params.project_id || !params.todolist_id || !params.content) throw new Error('project_id, todolist_id, and content required');
      return bcApi('POST', `/buckets/${params.project_id}/todolists/${params.todolist_id}/todos`, creds.access_token, creds.account_id, { content: params.content, due_on: params.due_on || null, assignee_ids: params.assignee_ids || [] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
