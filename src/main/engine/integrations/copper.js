/**
 * Copper (formerly ProsperWorks) CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function copperReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.copper.com', path: `/developer_api/v1${path}`, headers: { 'X-PW-AccessToken': creds.access_token, 'X-PW-Application': 'developer_api', 'X-PW-UserEmail': creds.user_email, 'Content-Type': 'application/json', 'Accept': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'copper',
  name: 'Copper',
  category: 'crm',
  icon: 'Briefcase',
  description: 'Manage Copper CRM people, companies, leads, and opportunities (Google Workspace native CRM).',
  configFields: [
    { key: 'access_token', label: 'API Key', type: 'password', required: true },
    { key: 'user_email', label: 'Your User Email', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.user_email) throw new Error('access_token and user_email required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await copperReq('GET', '/account', null, creds); return { success: true, message: `Connected: ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_people: async (params, creds) => copperReq('POST', '/people/search', { page_size: params.page_size || 25, sort_by: params.sort_by || 'name' }, creds),
    get_person: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return copperReq('GET', `/people/${params.id}`, null, creds);
    },
    list_opportunities: async (params, creds) => copperReq('POST', '/opportunities/search', { page_size: params.page_size || 25, pipeline_ids: params.pipeline_ids || [] }, creds),
    list_companies: async (params, creds) => copperReq('POST', '/companies/search', { page_size: params.page_size || 25 }, creds),
    list_leads: async (params, creds) => copperReq('POST', '/leads/search', { page_size: params.page_size || 25 }, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
