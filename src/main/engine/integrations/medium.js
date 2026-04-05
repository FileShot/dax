/**
 * Medium Publishing API Integration
 */
'use strict';
const https = require('https');

function mediumApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.medium.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'medium',
  name: 'Medium',
  category: 'cms',
  icon: 'BookOpen',
  description: 'Publish and manage articles on Medium.',
  configFields: [
    { key: 'access_token', label: 'Integration Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mediumApi('GET', '/me', creds.access_token); return { success: !!r.data, message: r.data ? `Connected as ${r.data.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => mediumApi('GET', '/me', creds.access_token),
    list_publications: async (params, creds) => {
      const user = await mediumApi('GET', '/me', creds.access_token);
      if (!user.data) throw new Error('Could not get user');
      return mediumApi('GET', `/users/${user.data.id}/publications`, creds.access_token);
    },
    create_post: async (params, creds) => {
      if (!params.title || !params.content) throw new Error('title and content required');
      const user = await mediumApi('GET', '/me', creds.access_token);
      if (!user.data) throw new Error('Could not get user');
      const userId = user.data.id;
      const postData = { title: params.title, contentFormat: params.format || 'html', content: params.content, publishStatus: params.status || 'draft' };
      if (params.tags) postData.tags = params.tags;
      if (params.canonical_url) postData.canonicalUrl = params.canonical_url;
      return mediumApi('POST', `/users/${userId}/posts`, creds.access_token, postData);
    },
    create_publication_post: async (params, creds) => {
      if (!params.publication_id || !params.title || !params.content) throw new Error('publication_id, title, and content required');
      return mediumApi('POST', `/publications/${params.publication_id}/posts`, creds.access_token, { title: params.title, contentFormat: params.format || 'html', content: params.content, publishStatus: params.status || 'draft', tags: params.tags || [] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
