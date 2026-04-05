/**
 * Crisp Chat API Integration
 */
'use strict';
const https = require('https');

function crispApi(method, path, identifier, key, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
    const opts = { method, hostname: 'api.crisp.chat', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'X-Crisp-Tier': 'plugin' } };
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
  id: 'crisp',
  name: 'Crisp',
  category: 'support',
  icon: 'MessageCircle',
  description: 'Manage conversations, contacts, and messages in Crisp.',
  configFields: [
    { key: 'identifier', label: 'Plugin Identifier', type: 'text', required: true },
    { key: 'key', label: 'Plugin Key', type: 'password', required: true },
    { key: 'website_id', label: 'Website ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.identifier || !creds.key || !creds.website_id) throw new Error('Identifier, key, and website ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await crispApi('GET', `/website/${creds.website_id}`, creds.identifier, creds.key); return { success: !!r.data?.website_id, message: `Connected to ${r.data?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_conversations: async (params, creds) => {
      const qs = new URLSearchParams({ page_number: params.page || 1 });
      if (params.status) qs.set('filter_is_unread', params.status === 'unread' ? 'true' : 'false');
      return crispApi('GET', `/website/${creds.website_id}/conversations/1?${qs}`, creds.identifier, creds.key);
    },
    get_conversation: async (params, creds) => { if (!params.session_id) throw new Error('session_id required'); return crispApi('GET', `/website/${creds.website_id}/conversation/${params.session_id}`, creds.identifier, creds.key); },
    send_message: async (params, creds) => {
      if (!params.session_id || !params.content) throw new Error('session_id and content required');
      return crispApi('POST', `/website/${creds.website_id}/conversation/${params.session_id}/message`, creds.identifier, creds.key, { type: 'text', content: params.content, from: 'operator', origin: 'chat' });
    },
    list_contacts: async (params, creds) => {
      const qs = new URLSearchParams({ page_number: params.page || 1 });
      return crispApi('GET', `/website/${creds.website_id}/people/profiles/1?${qs}`, creds.identifier, creds.key);
    },
    get_contact: async (params, creds) => { if (!params.people_id) throw new Error('people_id required'); return crispApi('GET', `/website/${creds.website_id}/people/profile/${params.people_id}`, creds.identifier, creds.key); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
