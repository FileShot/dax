/**
 * Postmark Transactional Email API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function pmReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.postmarkapp.com', path, headers: { 'Accept': 'application/json', 'X-Postmark-Server-Token': creds.server_token, ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'postmark',
  name: 'Postmark',
  category: 'marketing',
  icon: 'SendHorizontal',
  description: 'Send transactional emails and manage templates via Postmark.',
  configFields: [{ key: 'server_token', label: 'Server API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.server_token) throw new Error('server_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pmReq('GET', '/server', null, creds); return { success: true, message: `Connected: ${r.Name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_email: async (params, creds) => {
      if (!params.from || !params.to || !params.subject) throw new Error('from, to, and subject required');
      return pmReq('POST', '/email', { From: params.from, To: params.to, Subject: params.subject, HtmlBody: params.html_body, TextBody: params.text_body, Tag: params.tag, TrackOpens: params.track_opens !== false, TrackLinks: params.track_links || 'None' }, creds);
    },
    send_template: async (params, creds) => {
      if (!params.template_id || !params.to) throw new Error('template_id and to required');
      return pmReq('POST', '/email/withTemplate', { TemplateId: params.template_id, TemplateModel: params.model || {}, From: params.from, To: params.to }, creds);
    },
    list_templates: async (params, creds) => pmReq('GET', `/templates?Count=${params.count || 20}&Offset=${params.offset || 0}`, null, creds),
    get_bounces: async (params, creds) => pmReq('GET', `/bounces?count=${params.count || 25}&offset=${params.offset || 0}${params.type ? `&type=${params.type}` : ''}`, null, creds),
    get_stats: async (params, creds) => pmReq('GET', `/stats/outbound${params.tag ? `?tag=${params.tag}` : ''}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
