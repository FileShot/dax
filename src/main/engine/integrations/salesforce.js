/**
 * Salesforce REST API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function sfReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.instance_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const opts = { method, hostname: host, path: `/services/data/v59.0${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'salesforce',
  name: 'Salesforce',
  category: 'crm',
  icon: 'Cloud',
  description: 'Access and manage Salesforce CRM data — accounts, contacts, leads, opportunities, and SOQL queries.',
  configFields: [
    { key: 'instance_url', label: 'Instance URL (e.g. https://yourorg.salesforce.com)', type: 'text', required: true },
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.instance_url || !creds.access_token) throw new Error('instance_url and access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sfReq('GET', '/limits', null, creds); return { success: true, message: 'Salesforce connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query: async (params, creds) => {
      if (!params.soql) throw new Error('soql query required');
      return sfReq('GET', `/query/?q=${encodeURIComponent(params.soql)}`, null, creds);
    },
    get_record: async (params, creds) => {
      if (!params.object_type || !params.id) throw new Error('object_type and id required');
      return sfReq('GET', `/sobjects/${params.object_type}/${params.id}`, null, creds);
    },
    create_record: async (params, creds) => {
      if (!params.object_type || !params.data) throw new Error('object_type and data required');
      return sfReq('POST', `/sobjects/${params.object_type}/`, params.data, creds);
    },
    update_record: async (params, creds) => {
      if (!params.object_type || !params.id || !params.data) throw new Error('object_type, id, and data required');
      return sfReq('PATCH', `/sobjects/${params.object_type}/${params.id}`, params.data, creds);
    },
    describe_object: async (params, creds) => {
      if (!params.object_type) throw new Error('object_type required');
      return sfReq('GET', `/sobjects/${params.object_type}/describe/`, null, creds);
    },

    delete_record: async (params, creds) => {
      if (!params.object_type || !params.id) throw new Error('object_type and id required');
      await sfReq('DELETE', `/sobjects/${params.object_type}/${params.id}`, null, creds);
      return { success: true, deleted: params.id };
    },

    list_objects: async (params, creds) => {
      const result = await sfReq('GET', '/sobjects', null, creds);
      return (result.sobjects || []).filter((o) => o.queryable).map((o) => ({ name: o.name, label: o.label, custom: o.custom }));
    },

    search: async (params, creds) => {
      if (!params.sosl) throw new Error('sosl query required (e.g. FIND {Smith} IN ALL FIELDS RETURNING Account,Contact)');
      return sfReq('GET', `/search/?q=${encodeURIComponent(params.sosl)}`, null, creds);
    },

    get_current_user: async (params, creds) => {
      return sfReq('GET', '/chatter/users/me', null, creds);
    },

    bulk_query: async (params, creds) => {
      if (!params.soql) throw new Error('soql required');
      const result = await sfReq('GET', `/queryAll/?q=${encodeURIComponent(params.soql)}`, null, creds);
      return { totalSize: result.totalSize, done: result.done, records: result.records };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
