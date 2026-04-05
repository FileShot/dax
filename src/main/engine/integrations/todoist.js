/**
 * Todoist API Integration
 */
'use strict';
const https = require('https');

function todoistApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.todoist.com', path: `/rest/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode === 204) return resolve({ success: true });
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'todoist',
  name: 'Todoist',
  category: 'productivity',
  icon: 'ListTodo',
  description: 'Manage Todoist tasks, projects, and labels.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await todoistApi('GET', '/projects', creds.api_token); return { success: Array.isArray(r), message: Array.isArray(r) ? `Connected (${r.length} projects)` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_tasks: async (params, creds) => {
      let path = '/tasks';
      const qp = [];
      if (params.project_id) qp.push(`project_id=${params.project_id}`);
      if (params.filter) qp.push(`filter=${encodeURIComponent(params.filter)}`);
      if (qp.length) path += '?' + qp.join('&');
      return todoistApi('GET', path, creds.api_token);
    },
    create_task: async (params, creds) => {
      if (!params.content) throw new Error('content required');
      const body = { content: params.content };
      if (params.description) body.description = params.description;
      if (params.project_id) body.project_id = params.project_id;
      if (params.due_string) body.due_string = params.due_string;
      if (params.due_date) body.due_date = params.due_date;
      if (params.priority) body.priority = params.priority;
      if (params.labels) body.labels = params.labels;
      return todoistApi('POST', '/tasks', creds.api_token, body);
    },
    update_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      const body = {};
      if (params.content) body.content = params.content;
      if (params.description) body.description = params.description;
      if (params.due_string) body.due_string = params.due_string;
      if (params.priority) body.priority = params.priority;
      return todoistApi('POST', `/tasks/${params.task_id}`, creds.api_token, body);
    },
    complete_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      return todoistApi('POST', `/tasks/${params.task_id}/close`, creds.api_token);
    },
    get_projects: async (params, creds) => todoistApi('GET', '/projects', creds.api_token),
    create_project: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const body = { name: params.name };
      if (params.color) body.color = params.color;
      if (params.parent_id) body.parent_id = params.parent_id;
      return todoistApi('POST', '/projects', creds.api_token, body);
    },
    get_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      return todoistApi('GET', `/tasks/${params.task_id}`, creds.api_token);
    },
    delete_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      return todoistApi('DELETE', `/tasks/${params.task_id}`, creds.api_token);
    },
    reopen_task: async (params, creds) => {
      if (!params.task_id) throw new Error('task_id required');
      return todoistApi('POST', `/tasks/${params.task_id}/reopen`, creds.api_token);
    },
    get_sections: async (params, creds) => {
      const path = params.project_id ? `/sections?project_id=${params.project_id}` : '/sections';
      return todoistApi('GET', path, creds.api_token);
    },
    create_section: async (params, creds) => {
      if (!params.project_id || !params.name) throw new Error('project_id and name required');
      return todoistApi('POST', '/sections', creds.api_token, { project_id: params.project_id, name: params.name });
    },
    get_comments: async (params, creds) => {
      if (!params.task_id && !params.project_id) throw new Error('task_id or project_id required');
      const path = params.task_id ? `/comments?task_id=${params.task_id}` : `/comments?project_id=${params.project_id}`;
      return todoistApi('GET', path, creds.api_token);
    },
    add_comment: async (params, creds) => {
      if (!params.task_id || !params.content) throw new Error('task_id and content required');
      return todoistApi('POST', '/comments', creds.api_token, { task_id: params.task_id, content: params.content });
    },
    get_labels: async (params, creds) => todoistApi('GET', '/labels', creds.api_token),
    create_label: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return todoistApi('POST', '/labels', creds.api_token, { name: params.name, ...(params.color && { color: params.color }), ...(params.order !== undefined && { order: params.order }) });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
