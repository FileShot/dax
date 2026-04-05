/**
 * Supabase API Integration
 */
'use strict';
const https = require('https');

function supaApi(method, host, path, apiKey, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: host, path, headers: { 'apikey': apiKey, 'Authorization': `Bearer ${token || apiKey}`, 'Content-Type': 'application/json', 'Prefer': method === 'POST' ? 'return=representation' : '' } };
    const req = https.request(opts, (res) => {
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
  id: 'supabase',
  name: 'Supabase',
  category: 'data',
  icon: 'Database',
  description: 'Query and manage Supabase tables via REST and Auth APIs.',
  configFields: [
    { key: 'project_url', label: 'Project URL (e.g. https://xyz.supabase.co)', type: 'text', required: true },
    { key: 'anon_key', label: 'Anon/Public Key', type: 'password', required: true },
    { key: 'service_key', label: 'Service Role Key (optional, for admin)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.project_url || !creds.anon_key) throw new Error('Project URL and anon key required'); this.credentials = creds; const url = new URL(creds.project_url); this._host = url.hostname; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const url = new URL(creds.project_url); const r = await supaApi('GET', url.hostname, '/rest/v1/', creds.anon_key, creds.service_key); return { success: !r.message, message: r.message ? r.message : 'Connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    select: async (params, creds) => {
      if (!params.table) throw new Error('table required');
      const url = new URL(creds.project_url);
      let path = `/rest/v1/${params.table}?select=${params.select || '*'}`;
      if (params.filter) path += `&${params.filter}`;
      if (params.order) path += `&order=${params.order}`;
      if (params.limit) path += `&limit=${params.limit}`;
      return supaApi('GET', url.hostname, path, creds.anon_key, creds.service_key);
    },
    insert: async (params, creds) => {
      if (!params.table || !params.data) throw new Error('table and data required');
      const url = new URL(creds.project_url);
      return supaApi('POST', url.hostname, `/rest/v1/${params.table}`, creds.anon_key, creds.service_key, Array.isArray(params.data) ? params.data : [params.data]);
    },
    update: async (params, creds) => {
      if (!params.table || !params.data || !params.filter) throw new Error('table, data, and filter required');
      const url = new URL(creds.project_url);
      return supaApi('PATCH', url.hostname, `/rest/v1/${params.table}?${params.filter}`, creds.anon_key, creds.service_key, params.data);
    },
    delete: async (params, creds) => {
      if (!params.table || !params.filter) throw new Error('table and filter required');
      const url = new URL(creds.project_url);
      return supaApi('DELETE', url.hostname, `/rest/v1/${params.table}?${params.filter}`, creds.anon_key, creds.service_key);
    },
    rpc: async (params, creds) => {
      if (!params.function_name) throw new Error('function_name required');
      const url = new URL(creds.project_url);
      return supaApi('POST', url.hostname, `/rest/v1/rpc/${params.function_name}`, creds.anon_key, creds.service_key, params.args || {});
    },
    upsert: async (params, creds) => {
      if (!params.table || !params.data) throw new Error('table and data required');
      const url = new URL(creds.project_url);
      const opts = { method: 'POST', hostname: url.hostname, path: `/rest/v1/${params.table}`, headers: { 'apikey': creds.anon_key, 'Authorization': `Bearer ${creds.service_key || creds.anon_key}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' } };
      return new Promise((resolve, reject) => { const https = require('https'); const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); }); req.on('error', reject); req.write(JSON.stringify(Array.isArray(params.data) ? params.data : [params.data])); req.end(); });
    },
    list_users: async (params, creds) => {
      const url = new URL(creds.project_url);
      const page = params.page || 1;
      return supaApi('GET', url.hostname, `/auth/v1/admin/users?page=${page}&per_page=${params.per_page || 50}`, creds.anon_key, creds.service_key);
    },
    get_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const url = new URL(creds.project_url);
      return supaApi('GET', url.hostname, `/auth/v1/admin/users/${params.user_id}`, creds.anon_key, creds.service_key);
    },
    upload_file: async (params, creds) => {
      if (!params.bucket || !params.path || !params.body) throw new Error('bucket, path, and body required');
      const url = new URL(creds.project_url);
      return supaApi('POST', url.hostname, `/storage/v1/object/${params.bucket}/${params.path}`, creds.anon_key, creds.service_key, params.body);
    },
    list_buckets: async (params, creds) => {
      const url = new URL(creds.project_url);
      return supaApi('GET', url.hostname, '/storage/v1/bucket', creds.anon_key, creds.service_key);
    },
    list_files: async (params, creds) => {
      if (!params.bucket) throw new Error('bucket required');
      const url = new URL(creds.project_url);
      return supaApi('POST', url.hostname, `/storage/v1/object/list/${params.bucket}`, creds.anon_key, creds.service_key, { prefix: params.prefix || '', limit: params.limit || 100 });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
