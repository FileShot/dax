/**
 * Streak CRM (Gmail-based) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function streakReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = 'Basic ' + Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname: 'www.streak.com', path: `/api/v1${path}`, headers: { 'Authorization': auth, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'streak',
  name: 'Streak',
  category: 'crm',
  icon: 'Mail',
  description: 'Manage Streak CRM pipelines, boxes (deals), and contacts directly in Gmail.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await streakReq('GET', '/users/me', null, creds); return { success: true, message: `Connected as ${r.displayName || r.email}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_pipelines: async (params, creds) => streakReq('GET', '/pipelines', null, creds),
    get_pipeline: async (params, creds) => {
      if (!params.pipeline_key) throw new Error('pipeline_key required');
      return streakReq('GET', `/pipelines/${params.pipeline_key}`, null, creds);
    },
    list_boxes: async (params, creds) => {
      if (!params.pipeline_key) throw new Error('pipeline_key required');
      return streakReq('GET', `/pipelines/${params.pipeline_key}/boxes`, null, creds);
    },
    get_box: async (params, creds) => {
      if (!params.box_key) throw new Error('box_key required');
      return streakReq('GET', `/boxes/${params.box_key}`, null, creds);
    },
    search_boxes: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return streakReq('GET', `/search?query=${encodeURIComponent(params.query)}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
