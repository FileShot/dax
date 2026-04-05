/**
 * Zoho CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function zohoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const dc = creds.dc || 'com';
  const opts = { method, hostname: `www.zohoapis.${dc}`, path: `/crm/v6${path}`, headers: { 'Authorization': `Zoho-oauthtoken ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'zoho-crm',
  name: 'Zoho CRM',
  category: 'crm',
  icon: 'Users',
  description: 'Manage Zoho CRM records — contacts, leads, accounts, deals, and custom modules.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
    { key: 'dc', label: 'Data Center (com, eu, in, com.au, jp)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await zohoReq('GET', '/users?type=CurrentUser', null, creds); return { success: true, message: `Connected as ${r.users?.[0]?.full_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_records: async (params, creds) => {
      const module = params.module || 'Contacts';
      return zohoReq('GET', `/${module}?per_page=${params.per_page || 20}&page=${params.page || 1}`, null, creds);
    },
    get_record: async (params, creds) => {
      if (!params.module || !params.id) throw new Error('module and id required');
      return zohoReq('GET', `/${params.module}/${params.id}`, null, creds);
    },
    create_record: async (params, creds) => {
      if (!params.module || !params.data) throw new Error('module and data required');
      return zohoReq('POST', `/${params.module}`, { data: Array.isArray(params.data) ? params.data : [params.data] }, creds);
    },
    search_records: async (params, creds) => {
      if (!params.module || !params.criteria) throw new Error('module and criteria required');
      return zohoReq('GET', `/${params.module}/search?criteria=${encodeURIComponent(params.criteria)}`, null, creds);
    },
    update_record: async (params, creds) => {
      if (!params.module || !params.id || !params.data) throw new Error('module, id, and data required');
      return zohoReq('PUT', `/${params.module}/${params.id}`, { data: [params.data] }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
