/**
 * Kayako Customer Support API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function kayakoReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.email}:${creds.password}`).toString('base64');
  const opts = { method, hostname: `${creds.subdomain}.kayako.com`, path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'kayako',
  name: 'Kayako',
  category: 'support',
  icon: 'LifeBuoy',
  description: 'Manage cases, customers, and teams in Kayako unified customer service.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.email || !creds.password) throw new Error('subdomain, email, and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await kayakoReq('GET', '/cases?limit=1', null, creds); return { success: true, message: `Connected — ${r.total_count ?? 0} case(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_cases: async (params, creds) => kayakoReq('GET', `/cases?limit=${params.limit || 25}&offset=${params.offset || 0}&status_id=${params.status_id || ''}`, null, creds),
    get_case: async (params, creds) => {
      if (!params.case_id) throw new Error('case_id required');
      return kayakoReq('GET', `/cases/${params.case_id}`, null, creds);
    },
    create_case: async (params, creds) => {
      if (!params.subject || !params.requester_id) throw new Error('subject and requester_id required');
      return kayakoReq('POST', '/cases', { subject: params.subject, requester_id: params.requester_id, status: params.status || 'new', type_id: params.type_id || 3, channel_id: params.channel_id || 1 }, creds);
    },
    list_contacts: async (params, creds) => kayakoReq('GET', `/contacts?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    reply_case: async (params, creds) => {
      if (!params.case_id || !params.body) throw new Error('case_id and body required');
      return kayakoReq('POST', `/cases/${params.case_id}/replies`, { body: params.body, creator_id: params.creator_id }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
