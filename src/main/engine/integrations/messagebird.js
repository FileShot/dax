/**
 * MessageBird (Bird) Omnichannel API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function mbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'rest.messagebird.com', path: `/v1${path}`, headers: { 'Authorization': `AccessKey ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'messagebird',
  name: 'MessageBird',
  category: 'communication',
  icon: 'Send',
  description: 'Send SMS, WhatsApp, and email messages globally using MessageBird (now Bird).',
  configFields: [{ key: 'api_key', label: 'API Key (Live)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mbReq('GET', '/balance', null, creds); return { success: true, message: `Balance: ${r.amount} ${r.type}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_sms: async (params, creds) => {
      if (!params.originator || !params.recipients || !params.body) throw new Error('originator, recipients, and body required');
      return mbReq('POST', '/messages', { originator: params.originator, recipients: Array.isArray(params.recipients) ? params.recipients : [params.recipients], body: params.body }, creds);
    },
    get_message: async (params, creds) => {
      if (!params.message_id) throw new Error('message_id required');
      return mbReq('GET', `/messages/${params.message_id}`, null, creds);
    },
    list_messages: async (params, creds) => mbReq('GET', `/messages?limit=${params.limit || 25}&offset=${params.offset || 0}`, null, creds),
    send_email: async (params, creds) => {
      if (!params.from || !params.to || !params.subject) throw new Error('from, to, subject required');
      const body = JSON.stringify({ from: { name: params.from_name || 'Sender', address: params.from }, to: [{ address: params.to }], subject: params.subject, text: params.text, html: params.html });
      const opts = { method: 'POST', hostname: 'api.bird.com', path: '/workspaces/default/channels/default/messages', headers: { 'Authorization': `AccessKey ${creds.api_key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
      return makeRequest(opts, body);
    },
    get_balance: async (params, creds) => mbReq('GET', '/balance', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
