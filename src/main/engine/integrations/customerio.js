/**
 * Customer.io Behavioral Email API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function cioTrack(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = 'Basic ' + Buffer.from(`${creds.site_id}:${creds.api_key}`).toString('base64');
  return makeRequest({ method, hostname: 'track.customer.io', path: `/api/v1${path}`, headers: { 'Authorization': auth, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } }, bodyStr);
}
function cioApp(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  return makeRequest({ method, hostname: 'api.customer.io', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${creds.app_api_key || creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } }, bodyStr);
}

module.exports = {
  id: 'customerio',
  name: 'Customer.io',
  category: 'marketing',
  icon: 'UserCheck',
  description: 'Send behavioral emails, push notifications, and SMS via Customer.io.',
  configFields: [
    { key: 'site_id', label: 'Site ID', type: 'text', required: true },
    { key: 'api_key', label: 'Tracking API Key', type: 'password', required: true },
    { key: 'app_api_key', label: 'App API Key (for reporting)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.site_id || !creds.api_key) throw new Error('site_id and api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cioApp('GET', '/accounts', null, creds); return { success: true, message: 'Customer.io connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    identify_customer: async (params, creds) => {
      if (!params.id) throw new Error('customer id required');
      return cioTrack('PUT', `/customers/${params.id}`, params.attributes || {}, creds);
    },
    track_event: async (params, creds) => {
      if (!params.customer_id || !params.name) throw new Error('customer_id and event name required');
      return cioTrack('POST', `/customers/${params.customer_id}/events`, { name: params.name, data: params.data || {} }, creds);
    },
    delete_customer: async (params, creds) => {
      if (!params.id) throw new Error('customer id required');
      return cioTrack('DELETE', `/customers/${params.id}`, null, creds);
    },
    list_broadcasts: async (params, creds) => cioApp('GET', '/campaigns', null, creds),
    send_transactional: async (params, creds) => {
      if (!params.transactional_message_id || !params.to) throw new Error('transactional_message_id and to required');
      return makeRequest({ method: 'POST', hostname: 'api.customer.io', path: '/v1/send/email', headers: { 'Authorization': `Bearer ${creds.app_api_key || creds.api_key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(params)) } }, JSON.stringify({ transactional_message_id: params.transactional_message_id, to: params.to, identifiers: params.identifiers || {}, message_data: params.message_data || {} }));
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
