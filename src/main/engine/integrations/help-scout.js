/**
 * Help Scout API v2 Integration
 */
'use strict';
const https = require('https');

function hsApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.helpscout.net', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'help-scout',
  name: 'Help Scout',
  category: 'support',
  icon: 'HelpCircle',
  description: 'Manage conversations, mailboxes, and customers in Help Scout.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hsApi('GET', '/mailboxes', creds.access_token); return { success: !!r._embedded, message: `${r._embedded?.mailboxes?.length || 0} mailbox(es) found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => {
      const qs = new URLSearchParams({ page: params.page || 0, pageSize: params.page_size || 25 });
      if (params.status) qs.set('status', params.status);
      if (params.mailbox_id) qs.set('mailbox', params.mailbox_id);
      return hsApi('GET', `/conversations?${qs}`, creds.access_token);
    },
    get_conversation: async (params, creds) => { if (!params.conversation_id) throw new Error('conversation_id required'); return hsApi('GET', `/conversations/${params.conversation_id}`, creds.access_token); },
    create_conversation: async (params, creds) => {
      if (!params.subject || !params.mailbox_id || !params.customer_email) throw new Error('subject, mailbox_id, and customer_email required');
      return hsApi('POST', '/conversations', creds.access_token, { subject: params.subject, mailboxId: params.mailbox_id, type: params.type || 'email', status: params.status || 'active', customer: { email: params.customer_email }, threads: [{ type: 'customer', text: params.body || '' }] });
    },
    list_mailboxes: async (params, creds) => hsApi('GET', '/mailboxes', creds.access_token),
    reply_to_conversation: async (params, creds) => {
      if (!params.conversation_id || !params.text) throw new Error('conversation_id and text required');
      return hsApi('POST', `/conversations/${params.conversation_id}/threads`, creds.access_token, { type: 'reply', text: params.text });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
