/**
 * Infobip Omnichannel Messaging API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function infobipReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const hostname = `${creds.base_url}.api.infobip.com`.replace(/^https?:\/\//, '');
  const opts = { method, hostname, path: `/sms/2${path}`, headers: { 'Authorization': `App ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'infobip',
  name: 'Infobip',
  category: 'communication',
  icon: 'Globe',
  description: 'Send SMS, WhatsApp, email, and voice messages via Infobip omnichannel platform.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'base_url', label: 'Base URL prefix (e.g. xxxxx)', type: 'text', required: true, placeholder: 'xxxxx - from API docs' },
  ],
  async connect(creds) { if (!creds.api_key || !creds.base_url) throw new Error('api_key and base_url required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await infobipReq('GET', '/reports?limit=1', null, creds);
      return { success: true, message: `Connected — status: ok` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_sms: async (params, creds) => {
      if (!params.to || !params.text) throw new Error('to and text required');
      return infobipReq('POST', '/text/single', { from: params.from || 'InfoSMS', to: params.to, text: params.text }, creds);
    },
    send_bulk_sms: async (params, creds) => {
      if (!params.messages) throw new Error('messages array required');
      return infobipReq('POST', '/text/multi', { messages: params.messages }, creds);
    },
    get_delivery_reports: async (params, creds) => infobipReq('GET', `/reports?limit=${params.limit || 25}`, null, creds),
    get_logs: async (params, creds) => infobipReq('GET', `/logs?limit=${params.limit || 25}`, null, creds),
    send_whatsapp: async (params, creds) => {
      if (!params.to || !params.text) throw new Error('to and text required');
      const hostname = `${creds.base_url}.api.infobip.com`;
      const body = JSON.stringify({ from: params.from, to: params.to, content: { text: params.text } });
      const opts = { method: 'POST', hostname, path: '/whatsapp/1/message/text', headers: { 'Authorization': `App ${creds.api_key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
      return makeRequest(opts, body);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
