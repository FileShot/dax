/**
 * Groove HQ API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function grooveReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.groovehq.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'groove',
  name: 'Groove',
  category: 'support',
  icon: 'Tool',
  description: 'Manage tickets, customers, and agents in Groove small-business help desk.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await grooveReq('GET', '/tickets?page=1&per_page=1', null, creds); return { success: true, message: `Connected — ${r.meta?.pagination?.total_count ?? 0} ticket(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_tickets: async (params, creds) => grooveReq('GET', `/tickets?page=${params.page || 1}&per_page=${params.per_page || 25}&state=${params.state || 'opened'}`, null, creds),
    get_ticket: async (params, creds) => {
      if (!params.ticket_number) throw new Error('ticket_number required');
      return grooveReq('GET', `/tickets/${params.ticket_number}`, null, creds);
    },
    reply_to_ticket: async (params, creds) => {
      if (!params.ticket_number || !params.body) throw new Error('ticket_number and body required');
      return grooveReq('POST', `/tickets/${params.ticket_number}/messages`, { body: params.body, note: params.note || false }, creds);
    },
    list_agents: async (params, creds) => grooveReq('GET', '/agents', null, creds),
    list_customers: async (params, creds) => grooveReq('GET', `/customers?page=${params.page || 1}&per_page=${params.per_page || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
