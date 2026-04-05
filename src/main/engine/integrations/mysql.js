/**
 * PlanetScale MySQL HTTP API Integration
 */
'use strict';
const https = require('https');

function psApi(method, path, orgSlug, dbSlug, token, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${token}:`).toString('base64');
    const opts = { method, hostname: 'api.planetscale.com', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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

function psQuery(orgSlug, dbSlug, branch, token, query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const auth = Buffer.from(`${token}:`).toString('base64');
    const opts = { method: 'POST', hostname: `${orgSlug}.us-east.psdb.cloud`, path: `/v1/execute`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'mysql',
  name: 'MySQL (PlanetScale)',
  category: 'database',
  icon: 'Layers',
  description: 'Execute MySQL queries via PlanetScale serverless HTTP API.',
  configFields: [
    { key: 'api_token', label: 'Service Token', type: 'password', required: true },
    { key: 'org_slug', label: 'Organization Slug', type: 'text', required: true },
    { key: 'db_slug', label: 'Database Name', type: 'text', required: true },
    { key: 'branch', label: 'Branch (default: main)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_token || !creds.org_slug || !creds.db_slug) throw new Error('API token, org slug, and database name required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}`, creds.org_slug, creds.db_slug, creds.api_token); return { success: !!r.name, message: `Connected to ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    execute_query: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const upperQuery = params.query.trim().toUpperCase();
      const dangerous = ['DROP', 'TRUNCATE', 'ALTER'];
      if (!params.allow_destructive && dangerous.some((d) => upperQuery.startsWith(d))) throw new Error('Blocked destructive query. Set allow_destructive=true to permit');
      return psQuery(creds.org_slug, creds.db_slug, creds.branch || 'main', creds.api_token, params.query);
    },
    list_databases: async (params, creds) => psApi('GET', `/organizations/${creds.org_slug}/databases`, creds.org_slug, creds.db_slug, creds.api_token),
    list_branches: async (params, creds) => psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/branches`, creds.org_slug, creds.db_slug, creds.api_token),
    get_deploy_requests: async (params, creds) => psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/deploy-requests`, creds.org_slug, creds.db_slug, creds.api_token),
    get_schema: async (params, creds) => psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/branches/${creds.branch || 'main'}/schema`, creds.org_slug, creds.db_slug, creds.api_token),
    create_branch: async (params, creds) => {
      if (!params.name) throw new Error('branch name required');
      return psApi('POST', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/branches`, { name: params.name, parent_branch: params.parent_branch || 'main' }, creds.org_slug, creds.db_slug, creds.api_token);
    },
    delete_branch: async (params, creds) => {
      if (!params.branch) throw new Error('branch name required');
      return psApi('DELETE', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/branches/${params.branch}`, creds.org_slug, creds.db_slug, creds.api_token);
    },
    get_branch: async (params, creds) => {
      if (!params.branch) throw new Error('branch name required');
      return psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/branches/${params.branch}`, creds.org_slug, creds.db_slug, creds.api_token);
    },
    create_deploy_request: async (params, creds) => {
      if (!params.branch) throw new Error('branch required');
      return psApi('POST', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/deploy-requests`, { branch: params.branch, into_branch: params.into_branch || 'main' }, creds.org_slug, creds.db_slug, creds.api_token);
    },
    list_passwords: async (params, creds) => psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}/passwords`, creds.org_slug, creds.db_slug, creds.api_token),
    get_database: async (params, creds) => psApi('GET', `/organizations/${creds.org_slug}/databases/${creds.db_slug}`, creds.org_slug, creds.db_slug, creds.api_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
