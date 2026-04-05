/**
 * Zendesk Support API Integration
 */
'use strict';
const https = require('https');

function zdApi(method, path, subdomain, email, token, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${email}/token:${token}`).toString('base64');
    const opts = { method, hostname: `${subdomain}.zendesk.com`, path: `/api/v2${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'zendesk',
  name: 'Zendesk',
  category: 'support',
  icon: 'LifeBuoy',
  description: 'Manage support tickets, users, and organizations in Zendesk.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain (e.g. yourcompany)', type: 'text', required: true },
    { key: 'email', label: 'Agent Email', type: 'text', required: true },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.email || !creds.api_token) throw new Error('Subdomain, email, and API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await zdApi('GET', '/tickets/count.json', creds.subdomain, creds.email, creds.api_token); return { success: r.count !== undefined, message: `${r.count?.value || 0} total ticket(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_tickets: async (params, creds) => {
      const qs = new URLSearchParams({ sort_by: 'created_at', sort_order: 'desc', per_page: params.per_page || 25 });
      if (params.status) qs.set('status', params.status);
      return zdApi('GET', `/tickets.json?${qs}`, creds.subdomain, creds.email, creds.api_token);
    },
    get_ticket: async (params, creds) => { if (!params.ticket_id) throw new Error('ticket_id required'); return zdApi('GET', `/tickets/${params.ticket_id}.json`, creds.subdomain, creds.email, creds.api_token); },
    create_ticket: async (params, creds) => {
      if (!params.subject || !params.body) throw new Error('subject and body required');
      return zdApi('POST', '/tickets.json', creds.subdomain, creds.email, creds.api_token, { ticket: { subject: params.subject, comment: { body: params.body }, priority: params.priority || 'normal', type: params.type || 'question' } });
    },
    update_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      const ticket = {};
      if (params.status) ticket.status = params.status;
      if (params.priority) ticket.priority = params.priority;
      if (params.comment) ticket.comment = { body: params.comment };
      return zdApi('PUT', `/tickets/${params.ticket_id}.json`, creds.subdomain, creds.email, creds.api_token, { ticket });
    },
    list_users: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25 });
      if (params.role) qs.set('role', params.role);
      return zdApi('GET', `/users.json?${qs}`, creds.subdomain, creds.email, creds.api_token);
    },

    delete_ticket: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      await zdApi('DELETE', `/tickets/${params.ticket_id}.json`, creds.subdomain, creds.email, creds.api_token);
      return { success: true, deleted: params.ticket_id };
    },

    list_organizations: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25 });
      return zdApi('GET', `/organizations.json?${qs}`, creds.subdomain, creds.email, creds.api_token);
    },

    search_tickets: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(`type:ticket ${params.query}`);
      return zdApi('GET', `/search.json?query=${q}&per_page=${params.per_page || 25}`, creds.subdomain, creds.email, creds.api_token);
    },

    list_ticket_comments: async (params, creds) => {
      if (!params.ticket_id) throw new Error('ticket_id required');
      return zdApi('GET', `/tickets/${params.ticket_id}/comments.json`, creds.subdomain, creds.email, creds.api_token);
    },

    create_user: async (params, creds) => {
      if (!params.name || !params.email) throw new Error('name and email required');
      return zdApi('POST', '/users.json', creds.subdomain, creds.email, creds.api_token, { user: { name: params.name, email: params.email, role: params.role || 'end-user' } });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
