/**
 * WhatsApp Business Cloud API Integration
 */
'use strict';
const https = require('https');

function waApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'graph.facebook.com', path: `/v19.0${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'whatsapp',
  name: 'WhatsApp Business',
  category: 'communication',
  icon: 'MessageSquare',
  description: 'Send messages via WhatsApp Business Cloud API.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
    { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.phone_number_id) throw new Error('Access token and phone number ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await waApi('GET', `/${creds.phone_number_id}`, creds.access_token); return { success: !!r.id, message: r.id ? `Connected (${r.display_phone_number})` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_text: async (params, creds) => {
      if (!params.to || !params.text) throw new Error('to and text required');
      return waApi('POST', `/${creds.phone_number_id}/messages`, creds.access_token, { messaging_product: 'whatsapp', to: params.to, type: 'text', text: { body: params.text, preview_url: params.preview_url || false } });
    },
    send_template: async (params, creds) => {
      if (!params.to || !params.template_name) throw new Error('to and template_name required');
      const body = { messaging_product: 'whatsapp', to: params.to, type: 'template', template: { name: params.template_name, language: { code: params.language || 'en_US' } } };
      if (params.components) body.template.components = params.components;
      return waApi('POST', `/${creds.phone_number_id}/messages`, creds.access_token, body);
    },
    send_image: async (params, creds) => {
      if (!params.to || !params.image_url) throw new Error('to and image_url required');
      return waApi('POST', `/${creds.phone_number_id}/messages`, creds.access_token, { messaging_product: 'whatsapp', to: params.to, type: 'image', image: { link: params.image_url, caption: params.caption || '' } });
    },
    mark_read: async (params, creds) => {
      if (!params.message_id) throw new Error('message_id required');
      return waApi('POST', `/${creds.phone_number_id}/messages`, creds.access_token, { messaging_product: 'whatsapp', status: 'read', message_id: params.message_id });
    },
    get_templates: async (params, creds) => {
      if (!params.waba_id) throw new Error('waba_id required');
      return waApi('GET', `/${params.waba_id}/message_templates?limit=${params.limit || 20}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
