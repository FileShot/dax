/**
 * Close CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function closeReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = 'Basic ' + Buffer.from(`${creds.api_key}:`).toString('base64');
  const opts = { method, hostname: 'api.close.com', path: `/api/v1${path}`, headers: { 'Authorization': auth, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'close-crm',
  name: 'Close CRM',
  category: 'crm',
  icon: 'PhoneCall',
  description: 'Manage Close CRM leads, contacts, activities, and sequences.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await closeReq('GET', '/me/', null, creds); return { success: true, message: `Connected as ${r.display_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_leads: async (params, creds) => closeReq('GET', `/?_limit=${params.limit || 25}&_skip=${params.skip || 0}${params.query ? `&query=${encodeURIComponent(params.query)}` : ''}`, null, creds),
    get_lead: async (params, creds) => {
      if (!params.lead_id) throw new Error('lead_id required');
      return closeReq('GET', `/lead/${params.lead_id}/`, null, creds);
    },
    create_lead: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return closeReq('POST', '/lead/', { name: params.name, ...params }, creds);
    },
    list_contacts: async (params, creds) => closeReq('GET', `/contact/?_limit=${params.limit || 25}`, null, creds),
    list_opportunities: async (params, creds) => closeReq('GET', `/opportunity/?_limit=${params.limit || 25}&status_type=${params.status || 'active'}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
