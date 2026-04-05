/**
 * Nutshell CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function nutReq(method, body, creds) {
  const bodyStr = JSON.stringify(body);
  const auth = 'Basic ' + Buffer.from(`${creds.username}:${creds.api_key}`).toString('base64');
  return makeRequest({ method, hostname: 'app.nutshell.com', path: '/api/v1/json', headers: { 'Authorization': auth, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } }, bodyStr);
}

function rpcCall(method, params, creds) {
  return nutReq('POST', { jsonrpc: '2.0', method, params, id: Math.random().toString(36).slice(2) }, creds);
}

module.exports = {
  id: 'nutshell',
  name: 'Nutshell',
  category: 'crm',
  icon: 'Target',
  description: 'Manage Nutshell CRM leads, contacts, accounts, and activities via JSON-RPC.',
  configFields: [
    { key: 'username', label: 'Email / Username', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.username || !creds.api_key) throw new Error('username and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rpcCall('getApiEndpoint', { username: creds.username }, creds); return { success: true, message: 'Nutshell API connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    find_leads: async (params, creds) => rpcCall('findLeads', { query: params.query || {}, orderBy: params.order_by || 'name', limit: params.limit || 25, offset: params.offset || 0 }, creds),
    get_lead: async (params, creds) => {
      if (!params.lead_id) throw new Error('lead_id required');
      return rpcCall('getLead', { leadId: params.lead_id }, creds);
    },
    new_lead: async (params, creds) => {
      if (!params.lead) throw new Error('lead object required');
      return rpcCall('newLead', { lead: params.lead }, creds);
    },
    find_contacts: async (params, creds) => rpcCall('findContacts', { query: params.query || {}, limit: params.limit || 25 }, creds),
    find_accounts: async (params, creds) => rpcCall('findAccounts', { query: params.query || {}, limit: params.limit || 25 }, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
