/**
 * Google Drive API Integration
 */
'use strict';
const https = require('https');

function driveApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'www.googleapis.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'google-drive',
  name: 'Google Drive',
  category: 'productivity',
  icon: 'HardDrive',
  description: 'List, search, and manage files in Google Drive.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await driveApi('GET', '/drive/v3/about?fields=user', creds.access_token); return { success: !!r.user?.emailAddress, message: r.user?.emailAddress ? `Connected as ${r.user.emailAddress}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_files: async (params, creds) => {
      const pageSize = params.limit || 20;
      let path = `/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,parents,starred)`;
      if (params.folder_id) path += `&q='${params.folder_id}'+in+parents`;
      if (params.order_by) path += `&orderBy=${params.order_by}`;
      if (params.query) path += `&q=${encodeURIComponent(params.query)}`;
      return driveApi('GET', path, creds.access_token);
    },
    search_files: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const pageSize = params.limit || 20;
      const q = encodeURIComponent(`name contains '${params.query.replace(/'/g, "\\'")}'`);
      return driveApi('GET', `/drive/v3/files?q=${q}&pageSize=${pageSize}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)`, creds.access_token);
    },
    get_file: async (params, creds) => {
      if (!params.file_id) throw new Error('file_id required');
      return driveApi('GET', `/drive/v3/files/${params.file_id}?fields=id,name,mimeType,size,modifiedTime,webViewLink,description,parents,owners,starred`, creds.access_token);
    },
    create_folder: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const body = { name: params.name, mimeType: 'application/vnd.google-apps.folder' };
      if (params.parent_id) body.parents = [params.parent_id];
      return driveApi('POST', '/drive/v3/files', creds.access_token, body);
    },
    move_file: async (params, creds) => {
      if (!params.file_id || !params.folder_id) throw new Error('file_id and folder_id required');
      const file = await driveApi('GET', `/drive/v3/files/${params.file_id}?fields=parents`, creds.access_token);
      const prevParents = (file.parents || []).join(',');
      return driveApi('PATCH', `/drive/v3/files/${params.file_id}?addParents=${params.folder_id}&removeParents=${prevParents}`, creds.access_token);
    },
    rename_file: async (params, creds) => {
      if (!params.file_id || !params.name) throw new Error('file_id and name required');
      return driveApi('PATCH', `/drive/v3/files/${params.file_id}`, creds.access_token, { name: params.name });
    },
    copy_file: async (params, creds) => {
      if (!params.file_id) throw new Error('file_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.parent_id) body.parents = [params.parent_id];
      return driveApi('POST', `/drive/v3/files/${params.file_id}/copy`, creds.access_token, body);
    },
    delete_file: async (params, creds) => {
      if (!params.file_id) throw new Error('file_id required');
      return driveApi('DELETE', `/drive/v3/files/${params.file_id}`, creds.access_token);
    },
    star_file: async (params, creds) => {
      if (!params.file_id) throw new Error('file_id required');
      return driveApi('PATCH', `/drive/v3/files/${params.file_id}`, creds.access_token, { starred: params.starred !== false });
    },
    get_permissions: async (params, creds) => {
      if (!params.file_id) throw new Error('file_id required');
      return driveApi('GET', `/drive/v3/files/${params.file_id}/permissions?fields=permissions(id,role,type,emailAddress,displayName)`, creds.access_token);
    },
    add_permission: async (params, creds) => {
      if (!params.file_id || !params.role || !params.type) throw new Error('file_id, role, and type required');
      const body = { role: params.role, type: params.type };
      if (params.email) body.emailAddress = params.email;
      return driveApi('POST', `/drive/v3/files/${params.file_id}/permissions?sendNotificationEmail=${params.notify !== false}`, creds.access_token, body);
    },
    remove_permission: async (params, creds) => {
      if (!params.file_id || !params.permission_id) throw new Error('file_id and permission_id required');
      return driveApi('DELETE', `/drive/v3/files/${params.file_id}/permissions/${params.permission_id}`, creds.access_token);
    },
    list_revisions: async (params, creds) => {
      if (!params.file_id) throw new Error('file_id required');
      return driveApi('GET', `/drive/v3/files/${params.file_id}/revisions?fields=revisions(id,modifiedTime,size,lastModifyingUser)`, creds.access_token);
    },
    get_storage_quota: async (_params, creds) => {
      const r = await driveApi('GET', '/drive/v3/about?fields=storageQuota,user', creds.access_token);
      return { user: r.user?.emailAddress, usage: r.storageQuota?.usage, limit: r.storageQuota?.limit, usageInDrive: r.storageQuota?.usageInDrive };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
