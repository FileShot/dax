/**
 * Dropbox API Integration
 */
'use strict';
const https = require('https');

function dbxApi(method, hostname, path, token, body = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': contentType } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'dropbox',
  name: 'Dropbox',
  category: 'productivity',
  icon: 'Box',
  description: 'Manage files and folders in Dropbox.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dbxApi('POST', 'api.dropboxapi.com', '/2/users/get_current_account', creds.access_token, 'null'); return { success: !!r.account_id, message: r.account_id ? `Connected as ${r.name?.display_name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_folder: async (params, creds) => {
      const path = params.path || '';
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/list_folder', creds.access_token, { path, limit: params.limit || 100, recursive: params.recursive || false });
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/search_v2', creds.access_token, { query: params.query, options: { max_results: params.limit || 20, path: params.path || '' } });
    },
    get_metadata: async (params, creds) => {
      if (!params.path) throw new Error('path required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/get_metadata', creds.access_token, { path: params.path, include_media_info: true });
    },
    create_folder: async (params, creds) => {
      if (!params.path) throw new Error('path required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/create_folder_v2', creds.access_token, { path: params.path, autorename: params.autorename !== false });
    },
    delete: async (params, creds) => {
      if (!params.path) throw new Error('path required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/delete_v2', creds.access_token, { path: params.path });
    },
    move: async (params, creds) => {
      if (!params.from_path || !params.to_path) throw new Error('from_path and to_path required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/move_v2', creds.access_token, { from_path: params.from_path, to_path: params.to_path, autorename: params.autorename !== false });
    },
    copy: async (params, creds) => {
      if (!params.from_path || !params.to_path) throw new Error('from_path and to_path required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/copy_v2', creds.access_token, { from_path: params.from_path, to_path: params.to_path, autorename: params.autorename !== false });
    },
    get_sharing_link: async (params, creds) => {
      if (!params.path) throw new Error('path required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/sharing/create_shared_link_with_settings', creds.access_token, { path: params.path });
    },
    list_shared_links: async (params, creds) => {
      return dbxApi('POST', 'api.dropboxapi.com', '/2/sharing/list_shared_links', creds.access_token, { path: params.path || null, direct_only: params.direct_only || false });
    },
    revoke_shared_link: async (params, creds) => {
      if (!params.url) throw new Error('url required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/sharing/revoke_shared_link', creds.access_token, { url: params.url });
    },
    list_revisions: async (params, creds) => {
      if (!params.path) throw new Error('path required');
      const result = await dbxApi('POST', 'api.dropboxapi.com', '/2/files/list_revisions', creds.access_token, { path: params.path, limit: params.limit || 10 });
      return { path: params.path, entries: (result.entries || []).map((e) => ({ rev: e.rev, size: e.size, modified: e.client_modified, id: e.id })) };
    },
    restore_revision: async (params, creds) => {
      if (!params.path || !params.rev) throw new Error('path and rev required');
      return dbxApi('POST', 'api.dropboxapi.com', '/2/files/restore', creds.access_token, { path: params.path, rev: params.rev });
    },
    get_account: async (_params, creds) => {
      const r = await dbxApi('POST', 'api.dropboxapi.com', '/2/users/get_current_account', creds.access_token, 'null');
      return { account_id: r.account_id, name: r.name?.display_name, email: r.email, account_type: r.account_type?.['.tag'] };
    },
    get_space_usage: async (_params, creds) => {
      const r = await dbxApi('POST', 'api.dropboxapi.com', '/2/users/get_space_usage', creds.access_token, 'null');
      return { used: r.used, allocated: r.allocation?.allocated, quota_type: r.allocation?.['.tag'] };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
