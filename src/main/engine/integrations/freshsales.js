/**
 * Freshsales CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fsReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = `${creds.subdomain}.freshsales.io`;
  const opts = { method, hostname: host, path: `/api${path}`, headers: { 'Authorization': `Token token=${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'freshsales',
  name: 'Freshsales',
  category: 'crm',
  icon: 'TrendingUp',
  description: 'Manage Freshsales leads, contacts, accounts, and deals.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain (yourcompany in yourcompany.freshsales.io)', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.api_key) throw new Error('subdomain and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fsReq('GET', '/settings/sales_accounts', null, creds); return { success: true, message: 'Freshsales connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => fsReq('GET', `/contacts?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    get_contact: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return fsReq('GET', `/contacts/${params.id}`, null, creds);
    },
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return fsReq('POST', '/contacts', { contact: params }, creds);
    },
    list_deals: async (params, creds) => fsReq('GET', `/deals?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
    list_leads: async (params, creds) => fsReq('GET', `/leads?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
