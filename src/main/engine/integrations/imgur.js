/**
 * Imgur API Integration
 */
'use strict';
const https = require('https');

function imgurApi(method, path, clientId, token, body = null) {
  return new Promise((resolve, reject) => {
    const auth = token ? `Bearer ${token}` : `Client-ID ${clientId}`;
    const opts = { method, hostname: 'api.imgur.com', path: `/3${path}`, headers: { 'Authorization': auth, 'Content-Type': 'application/json' } };
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
  id: 'imgur',
  name: 'Imgur',
  category: 'storage',
  icon: 'Upload',
  description: 'Upload and manage images on Imgur.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token (optional)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.client_id) throw new Error('Client ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await imgurApi('GET', '/credits', creds.client_id, creds.access_token); return { success: r.success === true, message: r.success ? 'Connected to Imgur' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    upload_image: async (params, creds) => {
      if (!params.image) throw new Error('image (base64 or URL) required');
      return imgurApi('POST', '/image', creds.client_id, creds.access_token, { image: params.image, type: params.type || 'url', title: params.title, description: params.description });
    },
    get_image: async (params, creds) => { if (!params.image_id) throw new Error('image_id required'); return imgurApi('GET', `/image/${params.image_id}`, creds.client_id, creds.access_token); },
    delete_image: async (params, creds) => { if (!params.image_hash) throw new Error('image_hash required'); return imgurApi('DELETE', `/image/${params.image_hash}`, creds.client_id, creds.access_token); },
    get_album: async (params, creds) => { if (!params.album_id) throw new Error('album_id required'); return imgurApi('GET', `/album/${params.album_id}`, creds.client_id, creds.access_token); },
    get_account_images: async (params, creds) => {
      if (!creds.access_token) throw new Error('access_token required for account images');
      return imgurApi('GET', `/account/me/images/${params.page || 0}`, creds.client_id, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
