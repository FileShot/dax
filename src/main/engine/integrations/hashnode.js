/**
 * Hashnode GraphQL API Integration
 */
'use strict';
const https = require('https');

function hashnodeGql(query, variables, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = { method: 'POST', hostname: 'gql.hashnode.com', path: '/', headers: { 'Authorization': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'hashnode',
  name: 'Hashnode',
  category: 'cms',
  icon: 'Hash',
  description: 'Publish and manage articles on Hashnode.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
    { key: 'publication_id', label: 'Publication ID', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hashnodeGql('{ me { id name } }', {}, creds.access_token); return { success: !!r.data?.me, message: r.data?.me ? `Connected as ${r.data.me.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (params, creds) => hashnodeGql('{ me { id name username profilePicture publications(first: 10) { edges { node { id title url } } } } }', {}, creds.access_token),
    list_posts: async (params, creds) => {
      const pubId = params.publication_id || creds.publication_id;
      if (!pubId) throw new Error('publication_id required');
      return hashnodeGql(`query($id: ObjectId!, $first: Int!) { publication(id: $id) { posts(first: $first) { edges { node { id title slug brief publishedAt } } } } }`, { id: pubId, first: params.limit || 20 }, creds.access_token);
    },
    get_post: async (params, creds) => {
      if (!params.post_id) throw new Error('post_id required');
      return hashnodeGql(`query($id: ID!) { post(id: $id) { id title slug content { html markdown } publishedAt tags { name } } }`, { id: params.post_id }, creds.access_token);
    },
    publish_post: async (params, creds) => {
      if (!params.title || !params.content) throw new Error('title and content required');
      const pubId = params.publication_id || creds.publication_id;
      if (!pubId) throw new Error('publication_id required');
      return hashnodeGql(`mutation($input: PublishPostInput!) { publishPost(input: $input) { post { id title slug url } } }`, { input: { title: params.title, contentMarkdown: params.content, publicationId: pubId, tags: (params.tags || []).map((t) => ({ slug: t })) } }, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
