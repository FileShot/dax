/**
 * Facebook Graph API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fbGet(path, accessToken) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'graph.facebook.com', path: `/v19.0${path}${sep}access_token=${accessToken}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

function fbPost(path, accessToken, body) {
  const bodyStr = new URLSearchParams({ ...body, access_token: accessToken }).toString();
  const opts = { method: 'POST', hostname: 'graph.facebook.com', path: `/v19.0${path}`, headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) } };
  return makeRequest(opts, bodyStr);
}

function fbDelete(path, accessToken) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'DELETE', hostname: 'graph.facebook.com', path: `/v19.0${path}${sep}access_token=${accessToken}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'facebook',
  name: 'Facebook',
  category: 'social',
  icon: 'Facebook',
  description: 'Manage Facebook Pages, posts, and insights via the Graph API.',
  configFields: [
    { key: 'access_token', label: 'Page Access Token (or User Token)', type: 'password', required: true },
    { key: 'page_id', label: 'Page ID (optional)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fbGet('/me?fields=id,name', creds.access_token); if (r.error) return { success: false, message: r.error.message }; return { success: true, message: `Connected as ${r.name} (${r.id})` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (params, creds) => {
      const fields = params.fields || 'id,name,email';
      return fbGet(`/me?fields=${encodeURIComponent(fields)}`, creds.access_token);
    },
    get_page: async (params, creds) => {
      const pageId = params.page_id || creds.page_id || 'me';
      const fields = params.fields || 'id,name,fan_count,about,website';
      return fbGet(`/${pageId}?fields=${encodeURIComponent(fields)}`, creds.access_token);
    },
    get_page_posts: async (params, creds) => {
      const pageId = params.page_id || creds.page_id;
      if (!pageId) throw new Error('page_id required');
      const qs = new URLSearchParams({ fields: 'id,message,created_time,likes.summary(true),comments.summary(true)', limit: String(params.limit || 20) }).toString();
      return fbGet(`/${pageId}/posts?${qs}`, creds.access_token);
    },
    create_page_post: async (params, creds) => {
      const pageId = params.page_id || creds.page_id;
      if (!pageId || !params.message) throw new Error('page_id and message required');
      return fbPost(`/${pageId}/feed`, creds.access_token, { message: params.message, ...(params.link && { link: params.link }) });
    },
    get_page_insights: async (params, creds) => {
      const pageId = params.page_id || creds.page_id;
      if (!pageId) throw new Error('page_id required');
      const metric = params.metric || 'page_impressions,page_fans';
      const period = params.period || 'day';
      return fbGet(`/${pageId}/insights?metric=${encodeURIComponent(metric)}&period=${period}`, creds.access_token);
    },
    get_post: async (params, creds) => {
      if (!params.post_id) throw new Error('post_id required');
      const fields = params.fields || 'id,message,created_time,from,likes.summary(true),comments.summary(true)';
      return fbGet(`/${params.post_id}?fields=${encodeURIComponent(fields)}`, creds.access_token);
    },
    get_comments: async (params, creds) => {
      if (!params.object_id) throw new Error('object_id required');
      const qs = new URLSearchParams({ fields: 'id,message,from,created_time,like_count', limit: String(params.limit || 25) }).toString();
      return fbGet(`/${params.object_id}/comments?${qs}`, creds.access_token);
    },
    reply_comment: async (params, creds) => {
      if (!params.comment_id || !params.message) throw new Error('comment_id and message required');
      return fbPost(`/${params.comment_id}/comments`, creds.access_token, { message: params.message });
    },
    delete_post: async (params, creds) => {
      if (!params.post_id) throw new Error('post_id required');
      return fbDelete(`/${params.post_id}`, creds.access_token);
    },
    get_events: async (params, creds) => {
      const pageId = params.page_id || creds.page_id;
      if (!pageId) throw new Error('page_id required');
      const qs = new URLSearchParams({ fields: 'id,name,start_time,end_time,description,place', limit: String(params.limit || 20) }).toString();
      return fbGet(`/${pageId}/events?${qs}`, creds.access_token);
    },
    get_photos: async (params, creds) => {
      const pageId = params.page_id || creds.page_id;
      if (!pageId) throw new Error('page_id required');
      const qs = new URLSearchParams({ fields: 'id,name,images,created_time', limit: String(params.limit || 25) }).toString();
      return fbGet(`/${pageId}/photos?${qs}`, creds.access_token);
    },
    search: async (params, creds) => {
      if (!params.q) throw new Error('q required');
      const qs = new URLSearchParams({ q: params.q, type: params.type || 'page', limit: String(params.limit || 10) }).toString();
      return fbGet(`/search?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
