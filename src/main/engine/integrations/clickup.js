/**
 * ClickUp API Integration
 */
'use strict';
const https = require('https');

function clickupApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.clickup.com', path: `/api/v2${path}`, headers: { 'Authorization': token, 'Content-Type': 'application/json' } };
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
  id: 'clickup',
  name: 'ClickUp',
  category: 'productivity',
  icon: 'MousePointerClick',
  description: 'Manage ClickUp tasks, spaces, and lists.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await clickupApi('GET', '/user', creds.api_token); return { success: !!r.user?.id, message: r.user?.id ? `Authenticated as ${r.user.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_workspaces: async (params, creds) => clickupApi('GET', '/team', creds.api_token),
    get_spaces: async (params, creds) => { if (!params.team_id) throw new Error('team_id required'); return clickupApi('GET', `/team/${params.team_id}/space`, creds.api_token); },
    get_lists: async (params, creds) => {
      if (!params.folder_id && !params.space_id) throw new Error('folder_id or space_id required');
      const path = params.folder_id ? `/folder/${params.folder_id}/list` : `/space/${params.space_id}/list`;
      return clickupApi('GET', path, creds.api_token);
    },
    get_tasks: async (params, creds) => {
      if (!params.list_id) throw new Error('list_id required');
      const qp = [];
      if (params.statuses) qp.push(...params.statuses.map((s) => `statuses[]=${encodeURIComponent(s)}`));
      if (params.assignees) qp.push(...params.assignees.map((a) => `assignees[]=${a}`));
      const path = `/list/${params.list_id}/task${qp.length ? '?' + qp.join('&') : ''}`;
      return clickupApi('GET', path, creds.api_token);
    },
    create_task: async (params, creds) => {
      if (!params.list_id || !params.name) throw new Error('list_id and name required');
      const body = { name: params.name };
      if (params.description) body.description = params.description;
      if (params.priority) body.priority = params.priority;
      if (params.due_date) body.due_date = params.due_date;
      if (params.assignees) body.assignees = params.assignees;
      if (params.tags) body.tags = params.tags;
      if (params.status) body.status = params.status;
      return clickupApi('POST', `/list/${params.list_id}/task`, creds.api_token, body);
    },
    update_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.description) body.description = params.description;
      if (params.status) body.status = params.status;
      if (params.priority) body.priority = params.priority;
      if (params.due_date) body.due_date = params.due_date;
      return clickupApi('PUT', `/task/${params.task_id}`, creds.api_token, body);
    },

    delete_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      await clickupApi('DELETE', `/task/${params.task_id}`, creds.api_token);
      return { success: true, deleted: params.task_id };
    },

    get_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      return clickupApi('GET', `/task/${params.task_id}`, creds.api_token);
    },

    create_comment: async (params, creds) => {
      if (!params.task_id || !params.comment_text) throw new Error('task_id and comment_text required');
      return clickupApi('POST', `/task/${params.task_id}/comment`, creds.api_token, { comment_text: params.comment_text, assignee: params.assignee || null, notify_all: params.notify_all || false });
    },

    get_folders: async (params, creds) => {
      if (!params.space_id) throw new Error('space_id required');
      return clickupApi('GET', `/space/${params.space_id}/folder?archived=false`, creds.api_token);
    },

    get_members: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      return clickupApi('GET', `/task/${params.task_id}/member`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
