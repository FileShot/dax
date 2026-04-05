/**
 * Intercom API Integration
 */
'use strict';
const https = require('https');

function intercomApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.intercom.io', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Intercom-Version': '2.10' } };
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
  id: 'intercom',
  name: 'Intercom',
  category: 'support',
  icon: 'MessagesSquare',
  description: 'Manage contacts, conversations, and messages in Intercom.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await intercomApi('GET', '/me', creds.access_token); return { success: !!r.id, message: `Connected as ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 50 });
      if (params.role) qs.set('role', params.role);
      return intercomApi('GET', `/contacts?${qs}`, creds.access_token);
    },
    get_contact: async (params, creds) => { if (!params.contact_id) throw new Error('contact_id required'); return intercomApi('GET', `/contacts/${params.contact_id}`, creds.access_token); },
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      return intercomApi('POST', '/contacts', creds.access_token, { email: params.email, name: params.name || '', role: params.role || 'user', phone: params.phone || '' });
    },
    list_conversations: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 20 });
      if (params.state) qs.set('state', params.state);
      return intercomApi('GET', `/conversations?${qs}`, creds.access_token);
    },
    send_message: async (params, creds) => {
      if (!params.to || !params.body) throw new Error('to (contact_id) and body required');
      return intercomApi('POST', '/messages', creds.access_token, { message_type: 'inapp', subject: params.subject || '', body: params.body, from: { type: 'admin', id: params.from_admin_id || '' }, to: { type: 'user', id: params.to } });
    },

    update_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      const body = {};
      if (params.email) body.email = params.email;
      if (params.name) body.name = params.name;
      if (params.phone) body.phone = params.phone;
      if (params.custom_attributes) body.custom_attributes = params.custom_attributes;
      return intercomApi('PUT', `/contacts/${params.contact_id}`, creds.access_token, body);
    },

    delete_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      return intercomApi('DELETE', `/contacts/${params.contact_id}`, creds.access_token);
    },

    get_conversation: async (params, creds) => {
      if (!params.conversation_id) throw new Error('conversation_id required');
      return intercomApi('GET', `/conversations/${params.conversation_id}`, creds.access_token);
    },

    reply_to_conversation: async (params, creds) => {
      if (!params.conversation_id || !params.body) throw new Error('conversation_id and body required');
      return intercomApi('POST', `/conversations/${params.conversation_id}/reply`, creds.access_token, { message_type: 'comment', type: 'admin', admin_id: params.admin_id || '', body: params.body });
    },

    search_contacts: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return intercomApi('POST', '/contacts/search', creds.access_token, { query: { operator: 'AND', value: [{ field: 'email', operator: 'CONTAINS', value: params.query }] }, pagination: { per_page: params.limit || 20 } });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
