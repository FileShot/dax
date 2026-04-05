/**
 * Gorgias Customer Support API Integration (e-commerce focused)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function gorReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.email}:${creds.api_key}`).toString('base64');
  const opts = { method, hostname: `${creds.domain}.gorgias.com`, path: `/api${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'gorgias',
  name: 'Gorgias',
  category: 'support',
  icon: 'MessageSquare',
  description: 'Manage tickets, customers, and macros in Gorgias — the e-commerce helpdesk.',
  configFields: [
    { key: 'domain', label: 'Subdomain (e.g. mystore)', type: 'text', required: true },
    { key: 'email', label: 'Account Email', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.domain || !creds.email || !creds.api_key) throw new Error('domain, email, and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gorReq('GET', '/account', null, creds); return { success: true, message: `Account: ${r.name || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_tickets: async (params, creds) => gorReq('GET', `/tickets?limit=${params.limit || 25}&page=${params.page || 0}&status=${params.status || 'open'}`, null, creds),
    get_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      return gorReq('GET', `/tickets/${params.ticket_id}`, null, creds);
    },
    create_ticket: async (params, creds) => {
      if (!params.channel || !params.subject) throw new Error('channel and subject required');
      return gorReq('POST', '/tickets', { channel: params.channel, subject: params.subject, status: params.status || 'open', customer: params.customer, messages: params.messages || [] }, creds);
    },
    list_customers: async (params, creds) => gorReq('GET', `/customers?limit=${params.limit || 25}&page=${params.page || 0}&email=${params.email || ''}`, null, creds),
    get_account: async (params, creds) => gorReq('GET', '/account', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
