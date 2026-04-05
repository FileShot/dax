/**
 * Re:amaze Customer Support API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function reamReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.email}:${creds.api_key}`).toString('base64');
  const opts = { method, hostname: `${creds.subdomain}.reamaze.com`, path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 're-amaze',
  name: 'Re:amaze',
  category: 'support',
  icon: 'MessageCircle',
  description: 'Manage conversations, contacts, and reports in Re:amaze customer support.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain', type: 'text', required: true },
    { key: 'email', label: 'Account Email', type: 'text', required: true },
    { key: 'api_key', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.email || !creds.api_key) throw new Error('subdomain, email, and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await reamReq('GET', '/conversations?page=1', null, creds); return { success: true, message: `Connected — ${(r.conversations || []).length} conversation(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => reamReq('GET', `/conversations?page=${params.page || 1}&status=${params.status || ''}`, null, creds),
    get_conversation: async (params, creds) => {
      if (!params.slug) throw new Error('conversation slug required');
      return reamReq('GET', `/conversations/${params.slug}`, null, creds);
    },
    create_conversation: async (params, creds) => {
      if (!params.subject || !params.message) throw new Error('subject and message required');
      return reamReq('POST', '/conversations', { conversation: { subject: params.subject, message: { body: params.message }, contact: { email: params.contact_email } } }, creds);
    },
    list_contacts: async (params, creds) => reamReq('GET', `/contacts?page=${params.page || 1}`, null, creds),
    get_reports: async (params, creds) => reamReq('GET', '/reports/summary', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
