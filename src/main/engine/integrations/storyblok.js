/**
 * Storyblok Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function sbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'mapi.storyblok.com', path: `/v1${path}`, headers: { 'Authorization': creds.personal_access_token, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'storyblok',
  name: 'Storyblok',
  category: 'cms',
  icon: 'FileText',
  description: 'Manage stories, components, and assets in Storyblok headless CMS.',
  configFields: [{ key: 'personal_access_token', label: 'Personal Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.personal_access_token) throw new Error('personal_access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sbReq('GET', '/spaces', null, creds); return { success: true, message: `Connected — ${r.spaces?.length ?? 0} space(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_spaces: async (params, creds) => sbReq('GET', '/spaces', null, creds),
    list_stories: async (params, creds) => {
      if (!params.space_id) throw new Error('space_id required');
      return sbReq('GET', `/spaces/${params.space_id}/stories?per_page=${params.per_page || 25}&page=${params.page || 1}${params.content_type ? `&content_type=${params.content_type}` : ''}`, null, creds);
    },
    get_story: async (params, creds) => {
      if (!params.space_id || !params.story_id) throw new Error('space_id and story_id required');
      return sbReq('GET', `/spaces/${params.space_id}/stories/${params.story_id}`, null, creds);
    },
    list_components: async (params, creds) => {
      if (!params.space_id) throw new Error('space_id required');
      return sbReq('GET', `/spaces/${params.space_id}/components`, null, creds);
    },
    list_datasources: async (params, creds) => {
      if (!params.space_id) throw new Error('space_id required');
      return sbReq('GET', `/spaces/${params.space_id}/datasources`, null, creds);
    },
    list_assets: async (params, creds) => {
      if (!params.space_id) throw new Error('space_id required');
      return sbReq('GET', `/spaces/${params.space_id}/assets?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
