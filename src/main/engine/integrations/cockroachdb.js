/**
 * CockroachDB Cloud API Integration
 */
'use strict';
const https = require('https');

function crdbApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'cockroachlabs.cloud', path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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

function crdbSqlApi(clusterId, host, user, password, query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ statements: [{ sql: query }] });
    const auth = Buffer.from(`${user}:${password}`).toString('base64');
    const opts = { method: 'POST', hostname: host, path: '/api/v2/sql/', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
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
  id: 'cockroachdb',
  name: 'CockroachDB',
  category: 'database',
  icon: 'Bug',
  description: 'Manage and query CockroachDB Cloud clusters.',
  configFields: [
    { key: 'api_key', label: 'Cloud API Key', type: 'password', required: true },
    { key: 'cluster_host', label: 'Cluster SQL Host', type: 'text', required: false, placeholder: 'free-tier-host.cockroachlabs.cloud' },
    { key: 'db_user', label: 'Database Username', type: 'text', required: false },
    { key: 'db_password', label: 'Database Password', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('Cloud API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await crdbApi('GET', '/clusters', creds.api_key); return { success: !!r.clusters, message: `${r.clusters?.length || 0} cluster(s) found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_clusters: async (params, creds) => crdbApi('GET', '/clusters', creds.api_key),
    get_cluster: async (params, creds) => { if (!params.cluster_id) throw new Error('cluster_id required'); return crdbApi('GET', `/clusters/${params.cluster_id}`, creds.api_key); },
    execute_sql: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      if (!creds.cluster_host || !creds.db_user || !creds.db_password) throw new Error('cluster_host, db_user, and db_password required for SQL execution');
      const upper = params.query.trim().toUpperCase();
      if (!params.allow_destructive && ['DROP', 'TRUNCATE', 'ALTER'].some((d) => upper.startsWith(d))) throw new Error('Blocked destructive query. Set allow_destructive=true to permit');
      return crdbSqlApi(null, creds.cluster_host, creds.db_user, creds.db_password, params.query);
    },
    list_databases: async (params, creds) => { if (!creds.cluster_host || !creds.db_user || !creds.db_password) throw new Error('cluster_host, db_user, and db_password required'); return crdbSqlApi(null, creds.cluster_host, creds.db_user, creds.db_password, 'SHOW DATABASES'); },
    list_cluster_users: async (params, creds) => { if (!params.cluster_id) throw new Error('cluster_id required'); return crdbApi('GET', `/clusters/${params.cluster_id}/sql-users`, creds.api_key); },
    create_sql_user: async (params, creds) => {
      if (!params.cluster_id || !params.name || !params.password) throw new Error('cluster_id, name, and password required');
      return crdbApi('POST', `/clusters/${params.cluster_id}/sql-users`, { name: params.name, password: params.password }, creds.api_key);
    },
    delete_sql_user: async (params, creds) => {
      if (!params.cluster_id || !params.name) throw new Error('cluster_id and name required');
      return crdbApi('DELETE', `/clusters/${params.cluster_id}/sql-users/${params.name}`, null, creds.api_key);
    },
    list_regions: async (params, creds) => crdbApi('GET', '/clusters/available-regions', creds.api_key),
    delete_cluster: async (params, creds) => {
      if (!params.cluster_id) throw new Error('cluster_id required');
      return crdbApi('DELETE', `/clusters/${params.cluster_id}`, null, creds.api_key);
    },
    list_tables: async (params, creds) => {
      if (!creds.cluster_host || !creds.db_user || !creds.db_password) throw new Error('cluster_host, db_user, and db_password required');
      const db = params.database || 'defaultdb';
      return crdbSqlApi(null, creds.cluster_host, creds.db_user, creds.db_password, `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_catalog='${db}'`);
    },
    describe_table: async (params, creds) => {
      if (!params.table) throw new Error('table required');
      if (!creds.cluster_host || !creds.db_user || !creds.db_password) throw new Error('cluster_host, db_user, and db_password required');
      return crdbSqlApi(null, creds.cluster_host, creds.db_user, creds.db_password, `SHOW COLUMNS FROM ${params.table}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
