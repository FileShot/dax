/**
 * ActiveCampaign Marketing Automation API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function acReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.api_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { method, hostname: host, path: `/api/3${path}`, headers: { 'Api-Token': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'activecampaign',
  name: 'ActiveCampaign',
  category: 'marketing',
  icon: 'Zap',
  description: 'Manage ActiveCampaign contacts, lists, campaigns, and automations.',
  configFields: [
    { key: 'api_url', label: 'API URL (e.g. https://youraccountname.api-us1.com)', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_url || !creds.api_key) throw new Error('api_url and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await acReq('GET', '/contacts?limit=1', null, creds); return { success: true, message: `ActiveCampaign connected` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => acReq('GET', `/contacts?limit=${params.limit || 20}&offset=${params.offset || 0}${params.email ? `&email=${encodeURIComponent(params.email)}` : ''}`, null, creds),
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return acReq('POST', '/contacts', { contact: { email: params.email, firstName: params.first_name, lastName: params.last_name, phone: params.phone } }, creds);
    },
    get_contact: async (params, creds) => {
      if (!params.id) throw new Error('contact id required');
      return acReq('GET', `/contacts/${params.id}`, null, creds);
    },
    list_lists: async (params, creds) => acReq('GET', `/lists?limit=${params.limit || 20}`, null, creds),
    list_automations: async (params, creds) => acReq('GET', `/automations?limit=${params.limit || 20}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
