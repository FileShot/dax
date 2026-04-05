/**
 * Airtable API Integration
 */
'use strict';
const https = require('https');

function airtableApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.airtable.com', path: `/v0${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'airtable',
  name: 'Airtable',
  category: 'productivity',
  icon: 'Table',
  description: 'Read and write Airtable bases, tables, and records.',
  configFields: [
    { key: 'api_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await airtableApi('GET', '/meta/whoami', creds.api_token); return { success: !!r.id, message: r.id ? `Authenticated as ${r.id}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_bases: async (params, creds) => airtableApi('GET', '/meta/bases', creds.api_token),
    list_records: async (params, creds) => {
      if (!params.base_id || !params.table_name) throw new Error('base_id and table_name required');
      let path = `/${params.base_id}/${encodeURIComponent(params.table_name)}`;
      const qp = [];
      if (params.max_records) qp.push(`maxRecords=${params.max_records}`);
      if (params.view) qp.push(`view=${encodeURIComponent(params.view)}`);
      if (params.formula) qp.push(`filterByFormula=${encodeURIComponent(params.formula)}`);
      if (params.sort_field) qp.push(`sort%5B0%5D%5Bfield%5D=${encodeURIComponent(params.sort_field)}&sort%5B0%5D%5Bdirection%5D=${params.sort_dir || 'asc'}`);
      if (qp.length) path += '?' + qp.join('&');
      return airtableApi('GET', path, creds.api_token);
    },
    get_record: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.record_id) throw new Error('base_id, table_name, and record_id required');
      return airtableApi('GET', `/${params.base_id}/${encodeURIComponent(params.table_name)}/${params.record_id}`, creds.api_token);
    },
    create_record: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.fields) throw new Error('base_id, table_name, and fields required');
      return airtableApi('POST', `/${params.base_id}/${encodeURIComponent(params.table_name)}`, creds.api_token, { records: [{ fields: params.fields }] });
    },
    update_record: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.record_id || !params.fields) throw new Error('base_id, table_name, record_id, and fields required');
      return airtableApi('PATCH', `/${params.base_id}/${encodeURIComponent(params.table_name)}`, creds.api_token, { records: [{ id: params.record_id, fields: params.fields }] });
    },
    delete_record: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.record_id) throw new Error('base_id, table_name, and record_id required');
      return airtableApi('DELETE', `/${params.base_id}/${encodeURIComponent(params.table_name)}/${params.record_id}`, creds.api_token);
    },

    bulk_create_records: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.records) throw new Error('base_id, table_name, and records array required');
      const records = params.records.map((f) => ({ fields: f }));
      return airtableApi('POST', `/${params.base_id}/${encodeURIComponent(params.table_name)}`, creds.api_token, { records });
    },

    bulk_update_records: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.records) throw new Error('base_id, table_name, and records required');
      return airtableApi('PATCH', `/${params.base_id}/${encodeURIComponent(params.table_name)}`, creds.api_token, { records: params.records });
    },

    list_tables: async (params, creds) => {
      if (!params.base_id) throw new Error('base_id required');
      const result = await airtableApi('GET', `/meta/bases/${params.base_id}/tables`, creds.api_token);
      return (result.tables || []).map((t) => ({ id: t.id, name: t.name, primaryFieldId: t.primaryFieldId, fields: t.fields?.map((f) => ({ id: f.id, name: f.name, type: f.type })) }));
    },

    search_records: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.formula) throw new Error('base_id, table_name, and formula required');
      const path = `/${params.base_id}/${encodeURIComponent(params.table_name)}?filterByFormula=${encodeURIComponent(params.formula)}&maxRecords=${params.max_records || 25}`;
      return airtableApi('GET', path, creds.api_token);
    },

    get_view_records: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.view) throw new Error('base_id, table_name, and view required');
      const qs = new URLSearchParams({ view: params.view, maxRecords: String(params.max_records || 100) }).toString();
      return airtableApi('GET', `/${params.base_id}/${encodeURIComponent(params.table_name)}?${qs}`, creds.api_token);
    },

    list_views: async (params, creds) => {
      if (!params.base_id || !params.table_id) throw new Error('base_id and table_id required');
      return airtableApi('GET', `/meta/bases/${params.base_id}/tables/${params.table_id}/views`, creds.api_token);
    },

    create_table: async (params, creds) => {
      if (!params.base_id || !params.name) throw new Error('base_id and name required');
      const body = { name: params.name, fields: params.fields || [{ name: 'Name', type: 'singleLineText' }] };
      return airtableApi('POST', `/meta/bases/${params.base_id}/tables`, creds.api_token, body);
    },

    create_field: async (params, creds) => {
      if (!params.base_id || !params.table_id || !params.name || !params.type) throw new Error('base_id, table_id, name, and type required');
      return airtableApi('POST', `/meta/bases/${params.base_id}/tables/${params.table_id}/fields`, creds.api_token, { name: params.name, type: params.type, ...(params.options && { options: params.options }) });
    },

    sort_records: async (params, creds) => {
      if (!params.base_id || !params.table_name || !params.field) throw new Error('base_id, table_name, and field required');
      const qs = `sort[0][field]=${encodeURIComponent(params.field)}&sort[0][direction]=${params.direction || 'asc'}&maxRecords=${params.max_records || 25}`;
      return airtableApi('GET', `/${params.base_id}/${encodeURIComponent(params.table_name)}?${qs}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
