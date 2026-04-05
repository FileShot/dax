/**
 * Snowflake Data Cloud SQL API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function snowReq(method, path, body, creds) {
  if (!creds.account_identifier) throw new Error('account_identifier required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: `${creds.account_identifier}.snowflakecomputing.com`, path: `/api/v2${path}`, headers: { 'Authorization': `Bearer ${creds.jwt_token}`, 'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT', 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'snowflake',
  name: 'Snowflake',
  category: 'data',
  icon: 'Database',
  description: 'Execute queries and manage databases, schemas, and tables via Snowflake SQL API.',
  configFields: [
    { key: 'account_identifier', label: 'Account Identifier', type: 'string', required: true, description: 'e.g. myorg-myaccount' },
    { key: 'jwt_token', label: 'JWT Token', type: 'password', required: true, description: 'Key-pair JWT generated per Snowflake docs' },
    { key: 'warehouse', label: 'Warehouse', type: 'string', required: false },
    { key: 'database', label: 'Database', type: 'string', required: false },
    { key: 'schema', label: 'Schema', type: 'string', required: false },
  ],
  async connect(creds) { if (!creds.account_identifier || !creds.jwt_token) throw new Error('account_identifier and jwt_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await snowReq('POST', '/statements', { statement: 'SELECT CURRENT_VERSION()', timeout: 60, warehouse: creds.warehouse || undefined }, creds);
      return { success: true, message: `Connected to Snowflake (${r.data?.[0]?.[0] ?? 'OK'})` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    execute_query: async (params, creds) => {
      if (!params.statement) throw new Error('statement required');
      return snowReq('POST', '/statements', { statement: params.statement, timeout: params.timeout || 60, warehouse: params.warehouse || creds.warehouse, database: params.database || creds.database, schema: params.schema || creds.schema }, creds);
    },
    get_query_status: async (params, creds) => {
      if (!params.statement_handle) throw new Error('statement_handle required');
      return snowReq('GET', `/statements/${params.statement_handle}`, null, creds);
    },
    list_databases: async (params, creds) => snowReq('POST', '/statements', { statement: 'SHOW DATABASES', warehouse: creds.warehouse || undefined }, creds),
    list_schemas: async (params, creds) => {
      if (!params.database) throw new Error('database required');
      return snowReq('POST', '/statements', { statement: `SHOW SCHEMAS IN DATABASE "${params.database}"`, warehouse: creds.warehouse || undefined, database: params.database }, creds);
    },
    list_tables: async (params, creds) => {
      const db = params.database || creds.database;
      const sc = params.schema || creds.schema;
      if (!db || !sc) throw new Error('database and schema required');
      return snowReq('POST', '/statements', { statement: `SHOW TABLES IN SCHEMA "${db}"."${sc}"`, warehouse: creds.warehouse || undefined, database: db, schema: sc }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
