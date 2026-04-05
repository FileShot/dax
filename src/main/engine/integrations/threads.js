/**
 * Threads (Meta) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function threadsGet(path, accessToken) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'graph.threads.net', path: `/v1.0${path}${sep}access_token=${accessToken}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

function threadsPost(path, accessToken, body) {
  const bodyStr = new URLSearchParams({ ...body, access_token: accessToken }).toString();
  const opts = { method: 'POST', hostname: 'graph.threads.net', path: `/v1.0${path}`, headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(bodyStr) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'threads',
  name: 'Threads',
  category: 'social',
  icon: 'AtSign',
  description: 'Publish and retrieve Threads posts via the Meta Threads API.',
  configFields: [{ key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await threadsGet('/me?fields=id,username', creds.access_token); if (r.error) return { success: false, message: r.error.message }; return { success: true, message: `Connected as @${r.username}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (params, creds) => {
      const fields = params.fields || 'id,username,name,threads_biography,threads_profile_picture_url';
      return threadsGet(`/me?fields=${encodeURIComponent(fields)}`, creds.access_token);
    },
    list_threads: async (params, creds) => {
      const qs = new URLSearchParams({ fields: 'id,text,media_type,timestamp,permalink', limit: String(params.limit || 20), ...(params.before && { before: params.before }), ...(params.after && { after: params.after }) }).toString();
      return threadsGet(`/me/threads?${qs}`, creds.access_token);
    },
    get_thread: async (params, creds) => {
      if (!params.media_id) throw new Error('media_id required');
      const fields = params.fields || 'id,text,media_type,timestamp,permalink,like_count,replies_count';
      return threadsGet(`/${params.media_id}?fields=${encodeURIComponent(fields)}`, creds.access_token);
    },
    create_thread: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const userId = params.user_id || 'me';
      const r = await threadsPost(`/${userId}/threads`, creds.access_token, { media_type: 'TEXT', text: params.text });
      if (!r.id) throw new Error(r.error?.message || 'Failed to create thread container');
      return threadsPost(`/${userId}/threads_publish`, creds.access_token, { creation_id: r.id });
    },
    get_thread_insights: async (params, creds) => {
      if (!params.media_id) throw new Error('media_id required');
      const metrics = params.metrics || 'likes,replies,reposts,quotes,views';
      return threadsGet(`/${params.media_id}/insights?metric=${encodeURIComponent(metrics)}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
