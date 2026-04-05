/**
 * Linear API Integration (GraphQL)
 */
'use strict';
const https = require('https');

function linearGql(query, variables, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = { method: 'POST', hostname: 'api.linear.app', path: '/graphql', headers: { 'Authorization': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { const j = JSON.parse(data); resolve(j.errors ? { error: j.errors } : j.data); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'linear',
  name: 'Linear',
  category: 'productivity',
  icon: 'Layers',
  description: 'Manage Linear issues, projects, and cycles.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await linearGql('{ viewer { id name email } }', {}, creds.api_key); return { success: !!r.viewer?.id, message: r.viewer?.id ? `Authenticated as ${r.viewer.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_issues: async (params, creds) => {
      const limit = params.limit || 20;
      const filter = params.filter ? `, filter: ${params.filter}` : '';
      return linearGql(`{ issues(first: ${limit}${filter}) { nodes { id identifier title state { name } assignee { name } priority priorityLabel createdAt updatedAt } } }`, {}, creds.api_key);
    },
    get_issue: async (params, creds) => {
      if (!params.issue_id) throw new Error('issue_id required');
      return linearGql(`{ issue(id: "${params.issue_id}") { id identifier title description state { name } assignee { name } priority priorityLabel labels { nodes { name } } createdAt updatedAt } }`, {}, creds.api_key);
    },
    create_issue: async (params, creds) => {
      if (!params.title || !params.team_id) throw new Error('title and team_id required');
      const input = { title: params.title, teamId: params.team_id };
      if (params.description) input.description = params.description;
      if (params.priority) input.priority = params.priority;
      if (params.assignee_id) input.assigneeId = params.assignee_id;
      if (params.state_id) input.stateId = params.state_id;
      return linearGql('mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }', { input }, creds.api_key);
    },
    update_issue: async (params, creds) => {
      if (!params.issue_id) throw new Error('issue_id required');
      const input = {};
      if (params.title) input.title = params.title;
      if (params.description) input.description = params.description;
      if (params.state_id) input.stateId = params.state_id;
      if (params.priority !== undefined) input.priority = params.priority;
      if (params.assignee_id) input.assigneeId = params.assignee_id;
      return linearGql(`mutation($input: IssueUpdateInput!) { issueUpdate(id: "${params.issue_id}", input: $input) { success issue { id identifier title state { name } } } }`, { input }, creds.api_key);
    },
    get_teams: async (params, creds) => linearGql('{ teams { nodes { id name key } } }', {}, creds.api_key),
    get_projects: async (params, creds) => linearGql('{ projects { nodes { id name state startDate targetDate } } }', {}, creds.api_key),

    delete_issue: async (params, creds) => {
      if (!params.issue_id) throw new Error('issue_id required');
      return linearGql(`mutation { issueDelete(id: "${params.issue_id}") { success } }`, {}, creds.api_key);
    },

    add_comment: async (params, creds) => {
      if (!params.issue_id || !params.body) throw new Error('issue_id and body required');
      return linearGql('mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body createdAt } } }', { input: { issueId: params.issue_id, body: params.body } }, creds.api_key);
    },

    get_workflow_states: async (params, creds) => {
      const teamFilter = params.team_id ? `, filter: { team: { id: { eq: "${params.team_id}" } } }` : '';
      return linearGql(`{ workflowStates(first: 50${teamFilter}) { nodes { id name type color team { id name } } } }`, {}, creds.api_key);
    },

    list_members: async (params, creds) => {
      return linearGql('{ users(first: 50) { nodes { id name email displayName active } } }', {}, creds.api_key);
    },

    get_cycles: async (params, creds) => {
      const teamId = params.team_id;
      const filter = teamId ? `, filter: { team: { id: { eq: "${teamId}" } } }` : '';
      return linearGql(`{ cycles(first: 20${filter}) { nodes { id number name startsAt endsAt completedAt team { id name } } } }`, {}, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
