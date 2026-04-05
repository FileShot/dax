/**
 * Keap (formerly Infusionsoft) CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function keapReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.infusionsoft.com', path: `/crm/rest/v1${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'keap',
  name: 'Keap',
  category: 'crm',
  icon: 'Heart',
  description: 'Manage Keap/Infusionsoft contacts, opportunities, orders, and email campaigns.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await keapReq('GET', '/account/profile', null, creds); return { success: true, message: `Connected: ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => keapReq('GET', `/contacts?limit=${params.limit || 25}&offset=${params.offset || 0}${params.email ? `&email=${encodeURIComponent(params.email)}` : ''}`, null, creds),
    get_contact: async (params, creds) => {
      if (!params.id) throw new Error('contact id required');
      return keapReq('GET', `/contacts/${params.id}`, null, creds);
    },
    create_contact: async (params, creds) => {
      if (!params.email_addresses) throw new Error('email_addresses required');
      return keapReq('POST', '/contacts', params, creds);
    },
    list_opportunities: async (params, creds) => keapReq('GET', `/opportunities?limit=${params.limit || 25}`, null, creds),
    list_tags: async (params, creds) => keapReq('GET', `/tags?limit=${params.limit || 100}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
