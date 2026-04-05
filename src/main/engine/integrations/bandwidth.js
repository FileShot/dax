/**
 * Bandwidth Communications API Integration (SMS/Voice)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bwReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
  const opts = { method, hostname: 'messaging.bandwidth.com', path: `/api/v2/users/${creds.account_id}${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'bandwidth',
  name: 'Bandwidth',
  category: 'communication',
  icon: 'Phone',
  description: 'Send SMS/MMS messages and manage phone numbers via Bandwidth\'s communications API.',
  configFields: [
    { key: 'username', label: 'API Username', type: 'text', required: true },
    { key: 'password', label: 'API Password', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.username || !creds.password || !creds.account_id) throw new Error('username, password, and account_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bwReq('GET', '/applications?size=1', null, creds); return { success: true, message: `Account ${creds.account_id} connected` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_sms: async (params, creds) => {
      if (!params.to || !params.from || !params.text) throw new Error('to, from, and text required');
      return bwReq('POST', `/messages`, { to: Array.isArray(params.to) ? params.to : [params.to], from: params.from, text: params.text, applicationId: params.application_id, tag: params.tag }, creds);
    },
    send_mms: async (params, creds) => {
      if (!params.to || !params.from || !params.media) throw new Error('to, from, and media required');
      return bwReq('POST', `/messages`, { to: Array.isArray(params.to) ? params.to : [params.to], from: params.from, text: params.text || '', media: params.media, applicationId: params.application_id }, creds);
    },
    list_messages: async (params, creds) => bwReq('GET', `/messages?messageDirection=${params.direction || 'OUTBOUND'}&sourceTn=${params.source_tn || ''}&pageSize=${params.page_size || 25}`, null, creds),
    list_applications: async (params, creds) => bwReq('GET', '/applications', null, creds),
    list_phone_numbers: async (params, creds) => {
      const token = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
      const opts = { method: 'GET', hostname: 'dashboard.bandwidth.com', path: `/api/accounts/${creds.account_id}/tns?quantity=${params.quantity || 25}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json' } };
      return makeRequest(opts, null);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
