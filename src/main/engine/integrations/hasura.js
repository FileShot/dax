/**
 * Hasura GraphQL Engine API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function hasuraPost(path, body, creds) {
  const bodyStr = JSON.stringify(body);
  const hostname = new URL(creds.endpoint).hostname;
  const pathname = new URL(creds.endpoint).pathname.replace(/\/$/, '') + path;
  const opts = { method: 'POST', hostname, path: pathname, headers: { 'x-hasura-admin-secret': creds.admin_secret, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'hasura',
  name: 'Hasura',
  category: 'developer',
  icon: 'Database',
  description: 'Run GraphQL queries, mutations, and manage metadata via Hasura GraphQL Engine.',
  configFields: [
    { key: 'endpoint', label: 'Hasura Endpoint URL (e.g. https://my-project.hasura.app)', type: 'text', required: true },
    { key: 'admin_secret', label: 'Admin Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.endpoint || !creds.admin_secret) throw new Error('endpoint and admin_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hasuraPost('/v1/metadata', { type: 'export_metadata', args: {} }, creds); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to Hasura' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    run_query: async (params, creds) => {
      if (!params.query) throw new Error('GraphQL query string required');
      return hasuraPost('/v1/graphql', { query: params.query, ...(params.variables && { variables: params.variables }) }, creds);
    },
    execute_mutation: async (params, creds) => {
      if (!params.mutation) throw new Error('GraphQL mutation string required');
      return hasuraPost('/v1/graphql', { query: params.mutation, ...(params.variables && { variables: params.variables }) }, creds);
    },
    get_metadata: async (params, creds) => {
      return hasuraPost('/v1/metadata', { type: 'export_metadata', args: {} }, creds);
    },
    run_sql: async (params, creds) => {
      if (!params.sql) throw new Error('sql required');
      return hasuraPost('/v2/query', { type: 'run_sql', args: { sql: params.sql, cascade: params.cascade || false, read_only: params.read_only || false } }, creds);
    },
    track_table: async (params, creds) => {
      if (!params.table || !params.schema) throw new Error('table and schema required');
      return hasuraPost('/v1/metadata', { type: 'pg_track_table', args: { source: params.source || 'default', schema: params.schema, name: params.table } }, creds);
    },
    untrack_table: async (params, creds) => {
      if (!params.table || !params.schema) throw new Error('table and schema required');
      return hasuraPost('/v1/metadata', { type: 'pg_untrack_table', args: { source: params.source || 'default', table: { schema: params.schema, name: params.table } } }, creds);
    },
    reload_metadata: async (params, creds) => {
      return hasuraPost('/v1/metadata', { type: 'reload_metadata', args: { reload_remote_schemas: !!params.reload_remote_schemas } }, creds);
    },
    clear_metadata: async (params, creds) => {
      return hasuraPost('/v1/metadata', { type: 'clear_metadata', args: {} }, creds);
    },
    get_inconsistent_metadata: async (params, creds) => {
      return hasuraPost('/v1/metadata', { type: 'get_inconsistent_metadata', args: {} }, creds);
    },
    create_event_trigger: async (params, creds) => {
      if (!params.name || !params.table || !params.webhook) throw new Error('name, table, and webhook required');
      return hasuraPost('/v1/metadata', { type: 'pg_create_event_trigger', args: { name: params.name, source: params.source || 'default', table: { schema: params.schema || 'public', name: params.table }, webhook: params.webhook, insert: params.on_insert ? { columns: '*' } : undefined, update: params.on_update ? { columns: '*' } : undefined, delete: params.on_delete ? { columns: '*' } : undefined } }, creds);
    },
    create_action: async (params, creds) => {
      if (!params.name || !params.definition) throw new Error('name and definition required');
      return hasuraPost('/v1/metadata', { type: 'create_action', args: { name: params.name, definition: params.definition } }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
