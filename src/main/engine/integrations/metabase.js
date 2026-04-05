/**
 * Metabase Analytics API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getMetabaseToken(creds) {
  return _cache.get(`metabase:${creds.host}:${creds.username}`, async () => {
    const body = JSON.stringify({ username: creds.username, password: creds.password });
    const opts = { method: 'POST', hostname: creds.host, path: '/api/session', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    if (!r.id) throw new Error('Failed to get Metabase session token');
    // Session tokens expire in 2 weeks by default
    return { token: r.id, expiresAt: Date.now() + 7 * 24 * 3600000 };
  });
}

async function mbReq(method, path, body, creds) {
  const token = await getMetabaseToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: creds.host, path: `/api${path}`, headers: { 'X-Metabase-Session': token, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'metabase',
  name: 'Metabase',
  category: 'data',
  icon: 'BarChart',
  description: 'Query databases, view dashboards, and manage data with Metabase.',
  configFields: [
    { key: 'host', label: 'Host', type: 'string', required: true, description: 'Metabase instance hostname (e.g. analytics.mycompany.com)' },
    { key: 'username', label: 'Username (Email)', type: 'string', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.host || !creds.username || !creds.password) throw new Error('host, username, and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mbReq('GET', '/database', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} database(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_databases: async (params, creds) => mbReq('GET', '/database', null, creds),
    execute_query: async (params, creds) => {
      if (!params.database_id || !params.native_query) throw new Error('database_id and native_query required');
      return mbReq('POST', '/dataset', { database: params.database_id, type: 'native', native: { query: params.native_query }, parameters: [] }, creds);
    },
    list_dashboards: async (params, creds) => mbReq('GET', `/dashboard?&page_size=${params.page_size || 20}`, null, creds),
    get_dashboard: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return mbReq('GET', `/dashboard/${params.id}`, null, creds);
    },
    list_cards: async (params, creds) => mbReq('GET', `/card?page_size=${params.page_size || 20}`, null, creds),
    get_card_data: async (params, creds) => {
      if (!params.card_id) throw new Error('card_id required');
      return mbReq('POST', `/card/${params.card_id}/query`, {}, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
