/**
 * Bitbucket Cloud API Integration
 */
'use strict';
const https = require('https');

function bbApi(method, path, username, appPassword, body = null) {
  const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.bitbucket.org', path: `/2.0${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'bitbucket',
  name: 'Bitbucket',
  category: 'devops',
  icon: 'GitCommit',
  description: 'Manage Bitbucket repositories, pull requests, and pipelines.',
  configFields: [
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'app_password', label: 'App Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.username || !creds.app_password) throw new Error('Username and app password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bbApi('GET', '/user', creds.username, creds.app_password); return { success: !!r.account_id, message: r.account_id ? `Authenticated as ${r.display_name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_repos: async (params, creds) => {
      const workspace = params.workspace || creds.username;
      return bbApi('GET', `/repositories/${workspace}?pagelen=${params.limit || 20}`, creds.username, creds.app_password);
    },
    get_pull_requests: async (params, creds) => {
      if (!params.workspace || !params.repo) throw new Error('workspace and repo required');
      const state = params.state || 'OPEN';
      return bbApi('GET', `/repositories/${params.workspace}/${params.repo}/pullrequests?state=${state}`, creds.username, creds.app_password);
    },
    create_pull_request: async (params, creds) => {
      if (!params.workspace || !params.repo || !params.title || !params.source_branch) throw new Error('workspace, repo, title, and source_branch required');
      const body = { title: params.title, source: { branch: { name: params.source_branch } }, destination: { branch: { name: params.dest_branch || 'main' } } };
      if (params.description) body.description = params.description;
      return bbApi('POST', `/repositories/${params.workspace}/${params.repo}/pullrequests`, creds.username, creds.app_password, body);
    },
    get_commits: async (params, creds) => {
      if (!params.workspace || !params.repo) throw new Error('workspace and repo required');
      return bbApi('GET', `/repositories/${params.workspace}/${params.repo}/commits?pagelen=${params.limit || 20}`, creds.username, creds.app_password);
    },
    get_pipelines: async (params, creds) => {
      if (!params.workspace || !params.repo) throw new Error('workspace and repo required');
      return bbApi('GET', `/repositories/${params.workspace}/${params.repo}/pipelines/?sort=-created_on&pagelen=10`, creds.username, creds.app_password);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
