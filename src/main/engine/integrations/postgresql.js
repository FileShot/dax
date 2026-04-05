/**
 * PostgreSQL via PostgREST HTTP API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function pgRequest(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, baseUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (method === 'HEAD' || method === 'PATCH') headers['Prefer'] = 'return=representation';
    const opts = { method, hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, headers };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, statusCode: res.statusCode }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'postgresql',
  name: 'PostgreSQL',
  category: 'database',
  icon: 'Database',
  description: 'Query PostgreSQL databases via PostgREST REST API.',
  configFields: [
    { key: 'postgrest_url', label: 'PostgREST URL', type: 'text', required: true, placeholder: 'http://localhost:3000' },
    { key: 'jwt_token', label: 'JWT Token (optional)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.postgrest_url) throw new Error('PostgREST URL required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pgRequest('GET', creds.postgrest_url, '/', creds.jwt_token); return { success: true, message: 'Connected to PostgREST' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    select: async (params, creds) => {
      if (!params.table) throw new Error('table required');
      const qs = new URLSearchParams();
      if (params.select) qs.set('select', params.select);
      if (params.filter) Object.entries(params.filter).forEach(([k, v]) => qs.set(k, v));
      if (params.limit) qs.set('limit', params.limit);
      if (params.offset) qs.set('offset', params.offset);
      return pgRequest('GET', creds.postgrest_url, `/${params.table}?${qs}`, creds.jwt_token);
    },
    insert: async (params, creds) => { if (!params.table || !params.data) throw new Error('table and data required'); return pgRequest('POST', creds.postgrest_url, `/${params.table}`, creds.jwt_token, params.data); },
    update: async (params, creds) => {
      if (!params.table || !params.filter || !params.data) throw new Error('table, filter, and data required');
      const qs = new URLSearchParams(params.filter);
      return pgRequest('PATCH', creds.postgrest_url, `/${params.table}?${qs}`, creds.jwt_token, params.data);
    },
    delete_rows: async (params, creds) => {
      if (!params.table || !params.filter) throw new Error('table and filter required');
      const qs = new URLSearchParams(params.filter);
      return pgRequest('DELETE', creds.postgrest_url, `/${params.table}?${qs}`, creds.jwt_token);
    },
    rpc: async (params, creds) => { if (!params.function_name) throw new Error('function_name required'); return pgRequest('POST', creds.postgrest_url, `/rpc/${params.function_name}`, creds.jwt_token, params.args || {}); },
    upsert: async (params, creds) => {
      if (!params.table || !params.data) throw new Error('table and data required');
      return new Promise((resolve, reject) => {
        const u = new URL(`/${params.table}`, creds.postgrest_url);
        const lib = u.protocol === 'https:' ? https : http;
        const body = JSON.stringify(params.data);
        const opts = { method: 'POST', hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname, headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation', ...(creds.jwt_token && { 'Authorization': `Bearer ${creds.jwt_token}` }) } };
        const req = lib.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject); req.write(body); req.end();
      });
    },
    count: async (params, creds) => {
      if (!params.table) throw new Error('table required');
      return new Promise((resolve, reject) => {
        const u = new URL(`/${params.table}`, creds.postgrest_url);
        const query = params.filter ? `?${new URLSearchParams(params.filter)}` : '';
        const lib = u.protocol === 'https:' ? https : http;
        const opts = { method: 'HEAD', hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + query, headers: { 'Prefer': 'count=exact', ...(creds.jwt_token && { 'Authorization': `Bearer ${creds.jwt_token}` }) } };
        const req = lib.request(opts, (res) => { resolve({ count: res.headers['content-range']?.split('/')?.pop() || 'unknown' }); });
        req.on('error', reject); req.end();
      });
    },
    get_schema: async (params, creds) => pgRequest('GET', creds.postgrest_url, '/', creds.jwt_token),
    bulk_insert: async (params, creds) => {
      if (!params.table || !params.rows) throw new Error('table and rows array required');
      return pgRequest('POST', creds.postgrest_url, `/${params.table}`, creds.jwt_token, params.rows);
    },
    select_with_embed: async (params, creds) => {
      if (!params.table || !params.select) throw new Error('table and select required');
      const qs = new URLSearchParams({ select: params.select });
      if (params.filter) Object.entries(params.filter).forEach(([k, v]) => qs.set(k, v));
      return pgRequest('GET', creds.postgrest_url, `/${params.table}?${qs}`, creds.jwt_token);
    },
    get_openapi: async (params, creds) => pgRequest('GET', creds.postgrest_url, '/', creds.jwt_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
