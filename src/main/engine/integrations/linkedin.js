/**
 * LinkedIn Integration
 */
'use strict';
const https = require('https');

function linkedinApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.linkedin.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'linkedin',
  name: 'LinkedIn',
  category: 'social',
  icon: 'Linkedin',
  description: 'Get profile info and create posts via LinkedIn API.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await linkedinApi('GET', '/v2/userinfo', creds.access_token); return { success: r.status === 200, message: r.status === 200 ? `Authenticated as ${r.data?.name}` : `Error: ${r.status}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_profile: async (params, creds) => {
      const r = await linkedinApi('GET', '/v2/userinfo', creds.access_token);
      if (r.status !== 200) throw new Error(`Profile fetch failed: ${r.status}`);
      return r.data;
    },
    create_post: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const profile = await linkedinApi('GET', '/v2/userinfo', creds.access_token);
      const personId = profile.data?.sub;
      if (!personId) throw new Error('Could not get person ID');
      const body = { author: `urn:li:person:${personId}`, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: params.text }, shareMediaCategory: 'NONE' } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'PUBLIC' } };
      const r = await linkedinApi('POST', '/v2/ugcPosts', creds.access_token, body);
      return r.data;
    },
    get_connections: async (params, creds) => {
      const r = await linkedinApi('GET', '/v2/connections?q=viewer&count=50', creds.access_token);
      return r.data;
    },
    get_post: async (params, creds) => {
      if (!params.post_urn) throw new Error('post_urn required (e.g. urn:li:ugcPost:123)');
      const r = await linkedinApi('GET', `/v2/ugcPosts/${encodeURIComponent(params.post_urn)}`, creds.access_token);
      if (r.status >= 400) throw new Error(`LinkedIn error: ${r.status}`);
      return r.data;
    },
    delete_post: async (params, creds) => {
      if (!params.post_urn) throw new Error('post_urn required');
      const r = await linkedinApi('DELETE', `/v2/ugcPosts/${encodeURIComponent(params.post_urn)}`, creds.access_token);
      return { success: r.status === 204, status: r.status };
    },
    get_company: async (params, creds) => {
      if (!params.company_id) throw new Error('company_id required');
      const r = await linkedinApi('GET', `/v2/organizations/${params.company_id}?projection=(id,localizedName,localizedDescription,industries,websiteUrl)`, creds.access_token);
      if (r.status >= 400) throw new Error(`LinkedIn error: ${r.status}`);
      return r.data;
    },
    get_user_posts: async (params, creds) => {
      const profile = await linkedinApi('GET', '/v2/userinfo', creds.access_token);
      const personId = profile.data?.sub;
      if (!personId) throw new Error('Could not get person ID');
      const urn = encodeURIComponent(`urn:li:person:${personId}`);
      const r = await linkedinApi('GET', `/v2/ugcPosts?q=authors&authors=List(${urn})&count=${params.count || 10}`, creds.access_token);
      return r.data;
    },
    get_shares: async (params, creds) => {
      const profile = await linkedinApi('GET', '/v2/userinfo', creds.access_token);
      const personId = profile.data?.sub;
      if (!personId) throw new Error('Could not get person ID');
      const urn = encodeURIComponent(`urn:li:person:${personId}`);
      const r = await linkedinApi('GET', `/v2/shares?q=owners&owners=${urn}&count=${params.count || 10}`, creds.access_token);
      return r.data;
    },
    create_article_post: async (params, creds) => {
      if (!params.text || !params.article_url) throw new Error('text and article_url required');
      const profile = await linkedinApi('GET', '/v2/userinfo', creds.access_token);
      const personId = profile.data?.sub;
      if (!personId) throw new Error('Could not get person ID');
      const body = { author: `urn:li:person:${personId}`, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: params.text }, shareMediaCategory: 'ARTICLE', media: [{ status: 'READY', originalUrl: params.article_url, ...(params.title && { title: { text: params.title } }) }] } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'PUBLIC' } };
      const r = await linkedinApi('POST', '/v2/ugcPosts', creds.access_token, body);
      return r.data;
    },
    get_organization_acls: async (params, creds) => {
      const r = await linkedinApi('GET', `/v2/organizationAcls?q=roleAssignee&count=${params.count || 10}`, creds.access_token);
      return r.data;
    },
    search_people: async (params, creds) => {
      const kw = encodeURIComponent(params.keywords || '');
      const r = await linkedinApi('GET', `/v2/search?q=people&keywords=${kw}&count=${params.count || 10}`, creds.access_token);
      return r.data;
    },
    get_invitations: async (params, creds) => {
      const r = await linkedinApi('GET', `/v2/invitations?invitationType=CONNECTION&count=${params.count || 20}`, creds.access_token);
      return r.data;
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
