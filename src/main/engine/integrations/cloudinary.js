/**
 * Cloudinary Media Management Integration
 */
'use strict';
const https = require('https');

function cloudinaryApi(method, path, cloudName, apiKey, apiSecret, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const opts = { method, hostname: 'api.cloudinary.com', path: `/v1_1/${cloudName}${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'cloudinary',
  name: 'Cloudinary',
  category: 'storage',
  icon: 'Image',
  description: 'Manage images, videos, and media assets in Cloudinary.',
  configFields: [
    { key: 'cloud_name', label: 'Cloud Name', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'text', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.cloud_name || !creds.api_key || !creds.api_secret) throw new Error('Cloud name, API key, and API secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cloudinaryApi('GET', '/resources/image?max_results=1', creds.cloud_name, creds.api_key, creds.api_secret); return { success: !!r.resources || !!r.error, message: r.resources ? 'Connected to Cloudinary' : (r.error?.message || 'Auth failed') }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_resources: async (params, creds) => {
      const type = params.resource_type || 'image';
      return cloudinaryApi('GET', `/resources/${type}?max_results=${params.limit || 30}`, creds.cloud_name, creds.api_key, creds.api_secret);
    },
    get_resource: async (params, creds) => {
      if (!params.public_id) throw new Error('public_id required');
      const type = params.resource_type || 'image';
      return cloudinaryApi('GET', `/resources/${type}/upload/${params.public_id}`, creds.cloud_name, creds.api_key, creds.api_secret);
    },
    delete_resource: async (params, creds) => {
      if (!params.public_ids) throw new Error('public_ids array required');
      return cloudinaryApi('DELETE', '/resources/image/upload', creds.cloud_name, creds.api_key, creds.api_secret, { public_ids: params.public_ids });
    },
    search: async (params, creds) => {
      if (!params.expression) throw new Error('expression required');
      return cloudinaryApi('POST', '/resources/search', creds.cloud_name, creds.api_key, creds.api_secret, { expression: params.expression, max_results: params.limit || 30 });
    },
    list_folders: async (params, creds) => cloudinaryApi('GET', '/folders', creds.cloud_name, creds.api_key, creds.api_secret),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
