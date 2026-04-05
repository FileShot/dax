/**
 * Backblaze B2 Cloud Storage Integration
 */
'use strict';
const https = require('https');

function b2Api(method, hostname, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path, headers: { 'Authorization': token, 'Content-Type': 'application/json' } };
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

function authorizeB2(keyId, appKey) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${keyId}:${appKey}`).toString('base64');
    const opts = { method: 'GET', hostname: 'api.backblazeb2.com', path: '/b2api/v2/b2_authorize_account', headers: { 'Authorization': `Basic ${auth}` } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Auth parse error')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'backblaze-b2',
  name: 'Backblaze B2',
  category: 'storage',
  icon: 'HardDrive',
  description: 'Manage files and buckets in Backblaze B2 cloud storage.',
  configFields: [
    { key: 'key_id', label: 'Application Key ID', type: 'text', required: true },
    { key: 'app_key', label: 'Application Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.key_id || !creds.app_key) throw new Error('Key ID and application key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await authorizeB2(creds.key_id, creds.app_key); return { success: !!r.authorizationToken, message: r.authorizationToken ? 'Connected to B2' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_buckets: async (params, creds) => {
      const auth = await authorizeB2(creds.key_id, creds.app_key);
      const url = new URL(auth.apiUrl);
      return b2Api('POST', url.hostname, '/b2api/v2/b2_list_buckets', auth.authorizationToken, { accountId: auth.accountId });
    },
    list_files: async (params, creds) => {
      if (!params.bucket_id) throw new Error('bucket_id required');
      const auth = await authorizeB2(creds.key_id, creds.app_key);
      const url = new URL(auth.apiUrl);
      return b2Api('POST', url.hostname, '/b2api/v2/b2_list_file_names', auth.authorizationToken, { bucketId: params.bucket_id, maxFileCount: params.limit || 100, prefix: params.prefix || '' });
    },
    delete_file: async (params, creds) => {
      if (!params.file_id || !params.file_name) throw new Error('file_id and file_name required');
      const auth = await authorizeB2(creds.key_id, creds.app_key);
      const url = new URL(auth.apiUrl);
      return b2Api('POST', url.hostname, '/b2api/v2/b2_delete_file_version', auth.authorizationToken, { fileId: params.file_id, fileName: params.file_name });
    },
    create_bucket: async (params, creds) => {
      if (!params.bucket_name) throw new Error('bucket_name required');
      const auth = await authorizeB2(creds.key_id, creds.app_key);
      const url = new URL(auth.apiUrl);
      return b2Api('POST', url.hostname, '/b2api/v2/b2_create_bucket', auth.authorizationToken, { accountId: auth.accountId, bucketName: params.bucket_name, bucketType: params.bucket_type || 'allPrivate' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
