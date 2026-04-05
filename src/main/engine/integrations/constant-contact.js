/**
 * Constant Contact Email Marketing API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ccReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.cc.email', path: `/v3${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'constant-contact',
  name: 'Constant Contact',
  category: 'marketing',
  icon: 'AtSign',
  description: 'Manage Constant Contact email campaigns, contact lists, and reporting.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ccReq('GET', '/account/summary', null, creds); return { success: true, message: `Connected: ${r.organization_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => ccReq('GET', `/contacts?limit=${params.limit || 50}&status=${params.status || 'all'}`, null, creds),
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return ccReq('POST', '/contacts', { email_address: { address: params.email, permission_to_send: params.permission || 'implicit' }, first_name: params.first_name, last_name: params.last_name, list_memberships: params.list_ids || [] }, creds);
    },
    get_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      return ccReq('GET', `/contacts/${params.contact_id}`, null, creds);
    },
    list_contact_lists: async (params, creds) => ccReq('GET', `/contact_lists?limit=${params.limit || 50}`, null, creds),
    get_email_campaigns: async (params, creds) => ccReq('GET', `/emails?limit=${params.limit || 10}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
