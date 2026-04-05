/**
 * LiveAgent API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function laReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: `${creds.subdomain}.ladesk.com`, path: `/api/v3${path}`, headers: { 'apikey': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'liveagent',
  name: 'LiveAgent',
  category: 'support',
  icon: 'Headphones',
  description: 'Manage tickets, chats, and agents in LiveAgent help desk.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain (e.g. mycompany)', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.api_key) throw new Error('subdomain and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await laReq('GET', '/tickets?_page=1&_perPage=1', null, creds); return { success: true, message: `Connected to ${creds.subdomain}.ladesk.com` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_tickets: async (params, creds) => laReq('GET', `/tickets?_page=${params.page || 1}&_perPage=${params.per_page || 25}&_sortDir=${params.sort || 'DESC'}`, null, creds),
    get_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      return laReq('GET', `/tickets/${params.ticket_id}`, null, creds);
    },
    create_ticket: async (params, creds) => {
      if (!params.subject || !params.message) throw new Error('subject and message required');
      return laReq('POST', '/tickets', { subject: params.subject, message: params.message, email: params.email, departmentId: params.department_id }, creds);
    },
    list_agents: async (params, creds) => laReq('GET', `/agents?_page=${params.page || 1}&_perPage=${params.per_page || 25}`, null, creds),
    change_ticket_status: async (params, creds) => {
      if (!params.ticket_id || !params.status) throw new Error('ticket_id and status required');
      return laReq('PUT', `/tickets/${params.ticket_id}`, { status: params.status }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
