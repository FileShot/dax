/**
 * SparkPost (now Bird) Email API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function spReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.sparkpost.com', path: `/api/v1${path}`, headers: { 'Authorization': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'sparkpost',
  name: 'SparkPost',
  category: 'marketing',
  icon: 'Flame',
  description: 'Send transactional and bulk email via SparkPost with detailed analytics.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await spReq('GET', '/account', null, creds); return { success: true, message: `Connected: ${r.results?.company_name || 'SparkPost account'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_email: async (params, creds) => {
      if (!params.recipients || !params.from) throw new Error('recipients and from required');
      return spReq('POST', '/transmissions', { recipients: params.recipients, content: { from: params.from, subject: params.subject || '(no subject)', html: params.html, text: params.text, template_id: params.template_id }, substitution_data: params.substitution_data || {} }, creds);
    },
    list_templates: async (params, creds) => spReq('GET', '/templates', null, creds),
    get_template: async (params, creds) => {
      if (!params.template_id) throw new Error('template_id required');
      return spReq('GET', `/templates/${params.template_id}`, null, creds);
    },
    get_message_events: async (params, creds) => {
      const qs = params.recipients ? `?recipients=${params.recipients}` : '';
      return spReq('GET', `/message-events${qs}`, null, creds);
    },
    get_bounce_list: async (params, creds) => spReq('GET', `/suppression-list?types=bounces&limit=${params.limit || 100}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
