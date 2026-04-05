/**
 * SendGrid Email API Integration
 */
'use strict';
const https = require('https');

function sgApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.sendgrid.com', path: `/v3${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        if (res.statusCode === 202 || res.statusCode === 204) return resolve({ success: true, statusCode: res.statusCode });
        try { resolve(JSON.parse(d)); } catch { resolve({ raw: d, statusCode: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'sendgrid',
  name: 'SendGrid',
  category: 'communication',
  icon: 'Mail',
  description: 'Send emails and manage contacts via SendGrid.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sgApi('GET', '/user/profile', creds.api_key); return { success: !!r.username, message: r.username ? `Authenticated as ${r.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_email: async (params, creds) => {
      if (!params.to || !params.from || !params.subject) throw new Error('to, from, and subject required');
      const personalizations = [{ to: Array.isArray(params.to) ? params.to.map((e) => ({ email: e })) : [{ email: params.to }] }];
      if (params.cc) personalizations[0].cc = Array.isArray(params.cc) ? params.cc.map((e) => ({ email: e })) : [{ email: params.cc }];
      if (params.bcc) personalizations[0].bcc = Array.isArray(params.bcc) ? params.bcc.map((e) => ({ email: e })) : [{ email: params.bcc }];
      const body = { personalizations, from: { email: params.from, name: params.from_name || '' }, subject: params.subject, content: [{ type: params.html ? 'text/html' : 'text/plain', value: params.body || params.html || '' }] };
      if (params.reply_to) body.reply_to = { email: params.reply_to };
      return sgApi('POST', '/mail/send', creds.api_key, body);
    },
    list_contacts: async (params, creds) => sgApi('GET', `/marketing/contacts?page_size=${params.limit || 50}`, creds.api_key),
    add_contacts: async (params, creds) => {
      if (!params.contacts || !Array.isArray(params.contacts)) throw new Error('contacts array required');
      return sgApi('PUT', '/marketing/contacts', creds.api_key, { contacts: params.contacts });
    },
    get_stats: async (params, creds) => {
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      return sgApi('GET', `/stats?start_date=${start}`, creds.api_key);
    },

    delete_contacts: async (params, creds) => {
      if (!params.ids && !params.delete_all_contacts) throw new Error('ids (comma-separated) or delete_all_contacts required');
      let path = '/marketing/contacts';
      if (params.ids) path += `?ids=${params.ids}`;
      else path += '?delete_all_contacts=true';
      return sgApi('DELETE', path, creds.api_key);
    },

    list_lists: async (params, creds) => {
      const result = await sgApi('GET', `/marketing/lists?page_size=${params.limit || 50}`, creds.api_key);
      return (result.result || []).map((l) => ({ id: l.id, name: l.name, contact_count: l.contact_count }));
    },

    create_list: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return sgApi('POST', '/marketing/lists', creds.api_key, { name: params.name });
    },

    send_template_email: async (params, creds) => {
      if (!params.to || !params.from || !params.template_id) throw new Error('to, from, and template_id required');
      const body = {
        personalizations: [{ to: [{ email: params.to }], dynamic_template_data: params.template_data || {} }],
        from: { email: params.from, name: params.from_name || '' },
        template_id: params.template_id,
      };
      return sgApi('POST', '/mail/send', creds.api_key, body);
    },

    list_templates: async (params, creds) => {
      const result = await sgApi('GET', `/templates?generations=dynamic&page_size=${params.limit || 20}`, creds.api_key);
      return (result.templates || []).map((t) => ({ id: t.id, name: t.name, generation: t.generation, updated_at: t.updated_at }));
    },

    search_contacts: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const result = await sgApi('POST', '/marketing/contacts/search', creds.api_key, { query: params.query });
      return (result.result || []).map((c) => ({ id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name }));
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
