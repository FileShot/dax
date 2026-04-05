/**
 * Turso (libSQL edge database) API Integration
 */
'use strict';
const https = require('https');
const { makeRequest } = require('../../engine/integration-utils');

function tursoApi(method, path, body, token) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.turso.tech', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

function tursoQuery(databaseUrl, authToken, sql, bindings) {
  return new Promise((resolve, reject) => {
    const host = databaseUrl.replace(/^https?:\/\//, '');
    const body = JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, bindings: bindings || [] } }, { type: 'close' }] });
    const opts = { method: 'POST', hostname: host, path: '/v2/pipeline', headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'turso',
  name: 'Turso',
  category: 'developer',
  icon: 'Database',
  description: 'Manage Turso edge SQLite databases and run SQL queries via the Turso API.',
  configFields: [
    { key: 'api_token', label: 'Platform API Token', type: 'password', required: true },
    { key: 'org', label: 'Organization Name', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_token || !creds.org) throw new Error('api_token and org required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tursoApi('GET', `/organizations/${creds.org}/databases`, null, creds.api_token); if (Array.isArray(r.databases)) return { success: true, message: `Connected to Turso — ${r.databases.length} database(s)` }; if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to Turso' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_databases: async (params, creds) => {
      return tursoApi('GET', `/organizations/${creds.org}/databases`, null, creds.api_token);
    },
    get_database: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return tursoApi('GET', `/organizations/${creds.org}/databases/${params.database}`, null, creds.api_token);
    },
    create_database: async (params, creds) => {
      if (!params.name) throw new Error('database name required');
      return tursoApi('POST', `/organizations/${creds.org}/databases`, { name: params.name, ...(params.group && { group: params.group }) }, creds.api_token);
    },
    execute_sql: async (params, creds) => {
      if (!params.database_url || !params.auth_token || !params.sql) throw new Error('database_url, auth_token, and sql required');
      return tursoQuery(params.database_url, params.auth_token, params.sql, params.bindings);
    },
    list_groups: async (params, creds) => {
      return tursoApi('GET', `/organizations/${creds.org}/groups`, null, creds.api_token);
    },
    delete_database: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return tursoApi('DELETE', `/organizations/${creds.org}/databases/${params.database}`, null, creds.api_token);
    },
    create_token: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      const expiration = params.expiration || 'none';
      return tursoApi('POST', `/organizations/${creds.org}/databases/${params.database}/auth/tokens?expiration=${expiration}`, null, creds.api_token);
    },
    list_instances: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return tursoApi('GET', `/organizations/${creds.org}/databases/${params.database}/instances`, null, creds.api_token);
    },
    get_usage: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return tursoApi('GET', `/organizations/${creds.org}/databases/${params.database}/usage`, null, creds.api_token);
    },
    create_group: async (params, creds) => {
      if (!params.name || !params.location) throw new Error('name and location required');
      return tursoApi('POST', `/organizations/${creds.org}/groups`, { name: params.name, location: params.location }, creds.api_token);
    },
    get_stats: async (params, creds) => {
      if (!params.database) throw new Error('database name required');
      return tursoApi('GET', `/organizations/${creds.org}/databases/${params.database}/stats`, null, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
