/**
 * Freshdesk API Integration
 */
'use strict';
const https = require('https');

function fdApi(method, path, domain, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:X`).toString('base64');
    const opts = { method, hostname: `${domain}.freshdesk.com`, path: `/api/v2${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'freshdesk',
  name: 'Freshdesk',
  category: 'support',
  icon: 'MessageSquare',
  description: 'Manage support tickets and contacts in Freshdesk.',
  configFields: [
    { key: 'domain', label: 'Domain (e.g. yourcompany)', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.domain || !creds.api_key) throw new Error('Domain and API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fdApi('GET', '/tickets?per_page=1', creds.domain, creds.api_key); return { success: Array.isArray(r), message: 'Connected to Freshdesk' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_tickets: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 1 });
      if (params.status) qs.set('status', params.status);
      return fdApi('GET', `/tickets?${qs}`, creds.domain, creds.api_key);
    },
    get_ticket: async (params, creds) => { if (!params.ticket_id) throw new Error('ticket_id required'); return fdApi('GET', `/tickets/${params.ticket_id}`, creds.domain, creds.api_key); },
    create_ticket: async (params, creds) => {
      if (!params.subject || !params.description || !params.email) throw new Error('subject, description, and email required');
      return fdApi('POST', '/tickets', creds.domain, creds.api_key, { subject: params.subject, description: params.description, email: params.email, priority: params.priority || 1, status: params.status || 2 });
    },
    reply_to_ticket: async (params, creds) => {
      if (!params.ticket_id || !params.body) throw new Error('ticket_id and body required');
      return fdApi('POST', `/tickets/${params.ticket_id}/reply`, creds.domain, creds.api_key, { body: params.body });
    },
    list_contacts: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 1 });
      return fdApi('GET', `/contacts?${qs}`, creds.domain, creds.api_key);
    },

    update_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      const body = {};
      if (params.status) body.status = params.status;
      if (params.priority) body.priority = params.priority;
      if (params.subject) body.subject = params.subject;
      if (params.assignee_id) body.responder_id = params.assignee_id;
      return fdApi('PUT', `/tickets/${params.ticket_id}`, creds.domain, creds.api_key, body);
    },

    delete_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      await fdApi('DELETE', `/tickets/${params.ticket_id}`, creds.domain, creds.api_key);
      return { success: true, deleted: params.ticket_id };
    },

    create_contact: async (params, creds) => {
      if (!params.name || !params.email) throw new Error('name and email required');
      return fdApi('POST', '/contacts', creds.domain, creds.api_key, { name: params.name, email: params.email, phone: params.phone, description: params.description });
    },

    get_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      return fdApi('GET', `/contacts/${params.contact_id}`, creds.domain, creds.api_key);
    },

    list_agents: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25 });
      return fdApi('GET', `/agents?${qs}`, creds.domain, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
