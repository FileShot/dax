/**
 * Asana API Integration
 */
'use strict';
const https = require('https');

function asanaApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'app.asana.com', path: `/api/1.0${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'asana',
  name: 'Asana',
  category: 'productivity',
  icon: 'CheckSquare',
  description: 'Manage Asana tasks, projects, and workspaces.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await asanaApi('GET', '/users/me', creds.access_token); return { success: !!r.data?.gid, message: r.data?.gid ? `Authenticated as ${r.data.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_workspaces: async (params, creds) => { const r = await asanaApi('GET', '/workspaces', creds.access_token); return r.data; },
    get_projects: async (params, creds) => {
      if (!params.workspace_gid) throw new Error('workspace_gid required');
      const r = await asanaApi('GET', `/workspaces/${params.workspace_gid}/projects?opt_fields=name,notes,color,archived`, creds.access_token);
      return r.data;
    },
    get_tasks: async (params, creds) => {
      if (!params.project_gid && !params.assignee) throw new Error('project_gid or assignee required');
      let path = params.project_gid ? `/projects/${params.project_gid}/tasks` : '/tasks';
      const qp = ['opt_fields=name,completed,due_on,assignee.name,notes'];
      if (params.assignee) qp.push(`assignee=${params.assignee}`);
      if (!params.project_gid && params.workspace_gid) qp.push(`workspace=${params.workspace_gid}`);
      const r = await asanaApi('GET', `${path}?${qp.join('&')}`, creds.access_token);
      return r.data;
    },
    create_task: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const body = { data: { name: params.name } };
      if (params.notes) body.data.notes = params.notes;
      if (params.due_on) body.data.due_on = params.due_on;
      if (params.assignee) body.data.assignee = params.assignee;
      if (params.project_gid) body.data.projects = [params.project_gid];
      if (params.workspace_gid) body.data.workspace = params.workspace_gid;
      const r = await asanaApi('POST', '/tasks', creds.access_token, body);
      return r.data;
    },
    update_task: async (params, creds) => {
      if (!params.task_gid) throw new Error('task_gid required');
      const body = { data: {} };
      if (params.name) body.data.name = params.name;
      if (params.notes) body.data.notes = params.notes;
      if (params.completed !== undefined) body.data.completed = params.completed;
      if (params.due_on) body.data.due_on = params.due_on;
      const r = await asanaApi('PUT', `/tasks/${params.task_gid}`, creds.access_token, body);
      return r.data;
    },
    add_comment: async (params, creds) => {
      if (!params.task_gid || !params.text) throw new Error('task_gid and text required');
      const r = await asanaApi('POST', `/tasks/${params.task_gid}/stories`, creds.access_token, { data: { text: params.text } });
      return r.data;
    },

    get_task: async (params, creds) => {
      if (!params.task_gid) throw new Error('task_gid required');
      const r = await asanaApi('GET', `/tasks/${params.task_gid}?opt_fields=name,completed,due_on,assignee.name,notes,projects.name,tags.name`, creds.access_token);
      return r.data;
    },

    complete_task: async (params, creds) => {
      if (!params.task_gid) throw new Error('task_gid required');
      const r = await asanaApi('PUT', `/tasks/${params.task_gid}`, creds.access_token, { data: { completed: true } });
      return r.data;
    },

    delete_task: async (params, creds) => {
      if (!params.task_gid) throw new Error('task_gid required');
      await asanaApi('DELETE', `/tasks/${params.task_gid}`, creds.access_token);
      return { success: true, deleted: params.task_gid };
    },

    create_project: async (params, creds) => {
      if (!params.name || !params.workspace_gid) throw new Error('name and workspace_gid required');
      const body = { data: { name: params.name, workspace: params.workspace_gid } };
      if (params.notes) body.data.notes = params.notes;
      if (params.color) body.data.color = params.color;
      const r = await asanaApi('POST', '/projects', creds.access_token, body);
      return r.data;
    },

    list_tags: async (params, creds) => {
      if (!params.workspace_gid) throw new Error('workspace_gid required');
      const r = await asanaApi('GET', `/workspaces/${params.workspace_gid}/tags?opt_fields=name,color`, creds.access_token);
      return r.data;
    },

    get_sections: async (params, creds) => {
      if (!params.project_gid) throw new Error('project_gid required');
      const r = await asanaApi('GET', `/projects/${params.project_gid}/sections?opt_fields=name,created_at`, creds.access_token);
      return r.data;
    },

    create_section: async (params, creds) => {
      if (!params.project_gid || !params.name) throw new Error('project_gid and name required');
      const r = await asanaApi('POST', `/projects/${params.project_gid}/sections`, creds.access_token, { data: { name: params.name } });
      return r.data;
    },

    get_task_subtasks: async (params, creds) => {
      if (!params.task_gid) throw new Error('task_gid required');
      const r = await asanaApi('GET', `/tasks/${params.task_gid}/subtasks?opt_fields=name,assignee,due_on,completed`, creds.access_token);
      return r.data;
    },

    add_task_to_section: async (params, creds) => {
      if (!params.section_gid || !params.task_gid) throw new Error('section_gid and task_gid required');
      await asanaApi('POST', `/sections/${params.section_gid}/addTask`, creds.access_token, { data: { task: params.task_gid } });
      return { success: true };
    },

    create_tag: async (params, creds) => {
      if (!params.name || !params.workspace_gid) throw new Error('name and workspace_gid required');
      const body = { data: { name: params.name, workspace: params.workspace_gid } };
      if (params.color) body.data.color = params.color;
      const r = await asanaApi('POST', '/tags', creds.access_token, body);
      return r.data;
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error('Unknown action: ' + n); return a(p, this.credentials); },
};
