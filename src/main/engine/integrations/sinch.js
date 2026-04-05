/**
 * Sinch SMS/Voice API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function sinchReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const token = Buffer.from(`${creds.service_plan_id}:${creds.api_token}`).toString('base64');
  const opts = { method, hostname: 'us.sms.api.sinch.com', path: `/xms/v1/${creds.service_plan_id}${path}`, headers: { 'Authorization': `Basic ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'sinch',
  name: 'Sinch',
  category: 'communication',
  icon: 'MessageSquare',
  description: 'Send SMS, MMS, and manage inbound messages with Sinch cloud communications.',
  configFields: [
    { key: 'service_plan_id', label: 'Service Plan ID', type: 'text', required: true },
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.service_plan_id || !creds.api_token) throw new Error('service_plan_id and api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sinchReq('GET', '/batches?page_size=1', null, creds); return { success: true, message: `Connected — ${r.total_count ?? 0} batch(es)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_sms: async (params, creds) => {
      if (!params.to || !params.body) throw new Error('to and body required');
      return sinchReq('POST', '/batches', { from: params.from, to: Array.isArray(params.to) ? params.to : [params.to], body: params.body, delivery_report: params.delivery_report || 'none' }, creds);
    },
    list_batches: async (params, creds) => sinchReq('GET', `/batches?page_size=${params.page_size || 25}&page=${params.page || 0}`, null, creds),
    get_batch: async (params, creds) => {
      if (!params.batch_id) throw new Error('batch_id required');
      return sinchReq('GET', `/batches/${params.batch_id}`, null, creds);
    },
    list_inbound_messages: async (params, creds) => sinchReq('GET', `/inbounds?page_size=${params.page_size || 25}`, null, creds),
    send_group_sms: async (params, creds) => {
      if (!params.group_id || !params.body) throw new Error('group_id and body required');
      return sinchReq('POST', '/batches', { from: params.from, to: [`+group:${params.group_id}`], body: params.body }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
