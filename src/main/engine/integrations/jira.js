/**
 * Jira Cloud REST API Integration
 */
'use strict';
const https = require('https');

function jiraApi(method, domain, path, email, token, body = null) {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `${domain}.atlassian.net`, path: `/rest/api/3${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'jira',
  name: 'Jira',
  category: 'productivity',
  icon: 'Bug',
  description: 'Manage Jira issues, projects, and sprints.',
  configFields: [
    { key: 'domain', label: 'Jira Domain (e.g. mycompany)', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.domain || !creds.email || !creds.api_token) throw new Error('Domain, email, and API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await jiraApi('GET', creds.domain, '/myself', creds.email, creds.api_token); return { success: !!r.accountId, message: r.accountId ? `Authenticated as ${r.displayName}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_issues: async (params, creds) => {
      const jql = params.jql || 'assignee = currentUser() ORDER BY updated DESC';
      const maxResults = params.limit || 20;
      return jiraApi('POST', creds.domain, '/search', creds.email, creds.api_token, { jql, maxResults, fields: ['summary', 'status', 'assignee', 'priority', 'created', 'updated', 'issuetype'] });
    },
    get_issue: async (params, creds) => {
      if (!params.issue_key) throw new Error('issue_key required');
      return jiraApi('GET', creds.domain, `/issue/${params.issue_key}`, creds.email, creds.api_token);
    },
    create_issue: async (params, creds) => {
      if (!params.project_key || !params.summary) throw new Error('project_key and summary required');
      const fields = { project: { key: params.project_key }, summary: params.summary, issuetype: { name: params.issue_type || 'Task' } };
      if (params.description) fields.description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description }] }] };
      if (params.priority) fields.priority = { name: params.priority };
      if (params.assignee) fields.assignee = { accountId: params.assignee };
      return jiraApi('POST', creds.domain, '/issue', creds.email, creds.api_token, { fields });
    },
    update_issue: async (params, creds) => {
      if (!params.issue_key) throw new Error('issue_key required');
      const fields = {};
      if (params.summary) fields.summary = params.summary;
      if (params.priority) fields.priority = { name: params.priority };
      if (params.assignee) fields.assignee = { accountId: params.assignee };
      return jiraApi('PUT', creds.domain, `/issue/${params.issue_key}`, creds.email, creds.api_token, { fields });
    },
    transition_issue: async (params, creds) => {
      if (!params.issue_key || !params.transition_id) throw new Error('issue_key and transition_id required');
      return jiraApi('POST', creds.domain, `/issue/${params.issue_key}/transitions`, creds.email, creds.api_token, { transition: { id: params.transition_id } });
    },
    add_comment: async (params, creds) => {
      if (!params.issue_key || !params.text) throw new Error('issue_key and text required');
      return jiraApi('POST', creds.domain, `/issue/${params.issue_key}/comment`, creds.email, creds.api_token, { body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.text }] }] } });
    },
    get_projects: async (params, creds) => jiraApi('GET', creds.domain, '/project', creds.email, creds.api_token),

    delete_issue: async (params, creds) => {
      if (!params.issue_key) throw new Error('issue_key required');
      await jiraApi('DELETE', creds.domain, `/issue/${params.issue_key}`, creds.email, creds.api_token);
      return { success: true, deleted: params.issue_key };
    },

    get_transitions: async (params, creds) => {
      if (!params.issue_key) throw new Error('issue_key required');
      const result = await jiraApi('GET', creds.domain, `/issue/${params.issue_key}/transitions`, creds.email, creds.api_token);
      return (result.transitions || []).map((t) => ({ id: t.id, name: t.name, to: t.to?.name }));
    },

    link_issues: async (params, creds) => {
      if (!params.type || !params.inward_issue || !params.outward_issue) throw new Error('type, inward_issue, outward_issue required');
      return jiraApi('POST', creds.domain, '/issueLink', creds.email, creds.api_token, {
        type: { name: params.type },
        inwardIssue: { key: params.inward_issue },
        outwardIssue: { key: params.outward_issue },
      });
    },

    get_project: async (params, creds) => {
      if (!params.project_key) throw new Error('project_key required');
      return jiraApi('GET', creds.domain, `/project/${params.project_key}`, creds.email, creds.api_token);
    },

    search_users: async (params, creds) => {
      const query = params.query || '';
      const result = await jiraApi('GET', creds.domain, `/user/search?query=${encodeURIComponent(query)}&maxResults=${params.limit || 10}`, creds.email, creds.api_token);
      return (result || []).map((u) => ({ accountId: u.accountId, displayName: u.displayName, email: u.emailAddress, active: u.active }));
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
