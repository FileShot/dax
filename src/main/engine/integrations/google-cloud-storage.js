/**
 * Google Cloud Storage Integration
 */
'use strict';
const https = require('https');

function gcsApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'storage.googleapis.com', path: `/storage/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'google-cloud-storage',
  name: 'Google Cloud Storage',
  category: 'storage',
  icon: 'Cloud',
  description: 'Manage buckets and objects in Google Cloud Storage.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.project_id) throw new Error('Access token and project ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gcsApi('GET', `/b?project=${creds.project_id}`, creds.access_token); return { success: !!r.kind, message: r.items ? `${r.items.length} bucket(s) found` : 'Connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_buckets: async (params, creds) => gcsApi('GET', `/b?project=${creds.project_id}&maxResults=${params.limit || 50}`, creds.access_token),
    list_objects: async (params, creds) => {
      if (!params.bucket) throw new Error('bucket required');
      const prefix = params.prefix ? `&prefix=${encodeURIComponent(params.prefix)}` : '';
      return gcsApi('GET', `/b/${params.bucket}/o?maxResults=${params.limit || 50}${prefix}`, creds.access_token);
    },
    get_object: async (params, creds) => {
      if (!params.bucket || !params.object) throw new Error('bucket and object required');
      return gcsApi('GET', `/b/${params.bucket}/o/${encodeURIComponent(params.object)}`, creds.access_token);
    },
    delete_object: async (params, creds) => {
      if (!params.bucket || !params.object) throw new Error('bucket and object required');
      return gcsApi('DELETE', `/b/${params.bucket}/o/${encodeURIComponent(params.object)}`, creds.access_token);
    },
    create_bucket: async (params, creds) => {
      if (!params.bucket_name) throw new Error('bucket_name required');
      return gcsApi('POST', `/b?project=${creds.project_id}`, creds.access_token, { name: params.bucket_name, location: params.location || 'US' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
