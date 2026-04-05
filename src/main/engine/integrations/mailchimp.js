/**
 * Mailchimp Marketing API Integration
 */
'use strict';
const https = require('https');

function mcApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const dc = apiKey.split('-').pop();
    const opts = { method, hostname: `${dc}.api.mailchimp.com`, path: `/3.0${path}`, headers: { 'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`, 'Content-Type': 'application/json' } };
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
  id: 'mailchimp',
  name: 'Mailchimp',
  category: 'email-marketing',
  icon: 'Mail',
  description: 'Manage email lists, campaigns, and automations with Mailchimp.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.api_key.includes('-')) throw new Error('Valid API key with datacenter suffix required (e.g. key-us1)'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mcApi('GET', '/', creds.api_key); return { success: !!r.account_id, message: `Connected as ${r.account_name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_lists: async (params, creds) => {
      const qs = new URLSearchParams({ count: params.count || 25, offset: params.offset || 0 });
      return mcApi('GET', `/lists?${qs}`, creds.api_key);
    },
    get_list: async (params, creds) => { if (!params.list_id) throw new Error('list_id required'); return mcApi('GET', `/lists/${params.list_id}`, creds.api_key); },
    list_campaigns: async (params, creds) => {
      const qs = new URLSearchParams({ count: params.count || 25, offset: params.offset || 0 });
      if (params.status) qs.set('status', params.status);
      return mcApi('GET', `/campaigns?${qs}`, creds.api_key);
    },
    add_member: async (params, creds) => {
      if (!params.list_id || !params.email) throw new Error('list_id and email required');
      return mcApi('POST', `/lists/${params.list_id}/members`, creds.api_key, { email_address: params.email, status: params.status || 'subscribed', merge_fields: params.merge_fields || {} });
    },
    get_member: async (params, creds) => {
      if (!params.list_id || !params.email) throw new Error('list_id and email required');
      const hash = require('crypto').createHash('md5').update(params.email.toLowerCase()).digest('hex');
      return mcApi('GET', `/lists/${params.list_id}/members/${hash}`, creds.api_key);
    },

    update_member: async (params, creds) => {
      if (!params.list_id || !params.email) throw new Error('list_id and email required');
      const hash = require('crypto').createHash('md5').update(params.email.toLowerCase()).digest('hex');
      const body = {};
      if (params.status) body.status = params.status;
      if (params.merge_fields) body.merge_fields = params.merge_fields;
      if (params.tags) body.tags = params.tags.map((t) => ({ name: t, status: 'active' }));
      return mcApi('PATCH', `/lists/${params.list_id}/members/${hash}`, creds.api_key, body);
    },

    unsubscribe_member: async (params, creds) => {
      if (!params.list_id || !params.email) throw new Error('list_id and email required');
      const hash = require('crypto').createHash('md5').update(params.email.toLowerCase()).digest('hex');
      return mcApi('PATCH', `/lists/${params.list_id}/members/${hash}`, creds.api_key, { status: 'unsubscribed' });
    },

    create_campaign: async (params, creds) => {
      if (!params.list_id || !params.subject) throw new Error('list_id and subject required');
      return mcApi('POST', '/campaigns', creds.api_key, {
        type: params.type || 'regular',
        recipients: { list_id: params.list_id },
        settings: { subject_line: params.subject, from_name: params.from_name || 'Dax', reply_to: params.reply_to || 'noreply@example.com' },
      });
    },

    send_campaign: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return mcApi('POST', `/campaigns/${params.campaign_id}/actions/send`, creds.api_key);
    },

    get_campaign_report: async (params, creds) => {
      if (!params.campaign_id) throw new Error('campaign_id required');
      return mcApi('GET', `/reports/${params.campaign_id}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
