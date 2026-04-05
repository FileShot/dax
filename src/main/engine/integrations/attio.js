/**
 * Attio CRM API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function attioReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.attio.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'attio',
  name: 'Attio',
  category: 'crm',
  icon: 'Building2',
  description: 'Manage Attio CRM records, lists, attributes, and notes.',
  configFields: [{ key: 'access_token', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await attioReq('GET', '/workspace/members', null, creds); return { success: true, message: `Attio: ${(r.data || []).length} workspace members` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_objects: async (params, creds) => attioReq('GET', '/objects', null, creds),
    query_records: async (params, creds) => {
      if (!params.object) throw new Error('object slug required (e.g. people, companies)');
      return attioReq('POST', `/objects/${params.object}/records/query`, { filter: params.filter || null, limit: params.limit || 20, offset: params.offset || 0 }, creds);
    },
    get_record: async (params, creds) => {
      if (!params.object || !params.record_id) throw new Error('object and record_id required');
      return attioReq('GET', `/objects/${params.object}/records/${params.record_id}`, null, creds);
    },
    list_lists: async (params, creds) => attioReq('GET', '/lists', null, creds),
    create_note: async (params, creds) => {
      if (!params.parent_object || !params.parent_record_id || !params.title) throw new Error('parent_object, parent_record_id, and title required');
      return attioReq('POST', '/notes', { data: { parent_object: params.parent_object, parent_record_id: params.parent_record_id, title: params.title, content_plaintext: params.content || '' } }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
