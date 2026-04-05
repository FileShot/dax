/**
 * Firebase (Firestore REST API) Integration
 */
'use strict';
const https = require('https');

function firestoreApi(method, projectId, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'firestore.googleapis.com', path: `/v1/projects/${projectId}/databases/(default)/documents${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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

function decodeValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  if (v.mapValue) { const o = {}; for (const [k, mv] of Object.entries(v.mapValue.fields || {})) o[k] = decodeValue(mv); return o; }
  return v;
}

function decodeDoc(doc) {
  if (!doc || !doc.fields) return doc;
  const id = doc.name?.split('/').pop();
  const fields = {};
  for (const [k, v] of Object.entries(doc.fields)) fields[k] = decodeValue(v);
  return { id, ...fields, _path: doc.name, _createTime: doc.createTime, _updateTime: doc.updateTime };
}

module.exports = {
  id: 'firebase',
  name: 'Firebase',
  category: 'data',
  icon: 'Flame',
  description: 'Query and manage Firebase Firestore documents.',
  configFields: [
    { key: 'project_id', label: 'Firebase Project ID', type: 'text', required: true },
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.project_id || !creds.access_token) throw new Error('Project ID and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await firestoreApi('GET', creds.project_id, '?pageSize=1', creds.access_token); return { success: !r.error, message: r.error ? r.error.message : 'Connected to Firestore' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_documents: async (params, creds) => {
      if (!params.collection) throw new Error('collection required');
      const pageSize = params.limit || 20;
      const r = await firestoreApi('GET', creds.project_id, `/${params.collection}?pageSize=${pageSize}`, creds.access_token);
      return (r.documents || []).map(decodeDoc);
    },
    get_document: async (params, creds) => {
      if (!params.collection || !params.doc_id) throw new Error('collection and doc_id required');
      const r = await firestoreApi('GET', creds.project_id, `/${params.collection}/${params.doc_id}`, creds.access_token);
      return decodeDoc(r);
    },
    create_document: async (params, creds) => {
      if (!params.collection || !params.fields) throw new Error('collection and fields required');
      const docFields = {};
      for (const [k, v] of Object.entries(params.fields)) {
        if (typeof v === 'string') docFields[k] = { stringValue: v };
        else if (typeof v === 'number') docFields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        else if (typeof v === 'boolean') docFields[k] = { booleanValue: v };
        else if (v === null) docFields[k] = { nullValue: 'NULL_VALUE' };
        else docFields[k] = { stringValue: JSON.stringify(v) };
      }
      const path = params.doc_id ? `/${params.collection}?documentId=${params.doc_id}` : `/${params.collection}`;
      const r = await firestoreApi('POST', creds.project_id, path, creds.access_token, { fields: docFields });
      return decodeDoc(r);
    },
    delete_document: async (params, creds) => {
      if (!params.collection || !params.doc_id) throw new Error('collection and doc_id required');
      return firestoreApi('DELETE', creds.project_id, `/${params.collection}/${params.doc_id}`, creds.access_token);
    },
    query: async (params, creds) => {
      if (!params.collection) throw new Error('collection required');
      const structuredQuery = { from: [{ collectionId: params.collection }], limit: params.limit || 20 };
      if (params.where) {
        structuredQuery.where = { fieldFilter: { field: { fieldPath: params.where.field }, op: params.where.op || 'EQUAL', value: typeof params.where.value === 'string' ? { stringValue: params.where.value } : { integerValue: String(params.where.value) } } };
      }
      if (params.order_by) structuredQuery.orderBy = [{ field: { fieldPath: params.order_by }, direction: params.order_dir || 'ASCENDING' }];
      const r = await firestoreApi('POST', creds.project_id, ':runQuery', creds.access_token, { structuredQuery });
      return (Array.isArray(r) ? r : []).filter((d) => d.document).map((d) => decodeDoc(d.document));
    },
    update_document: async (params, creds) => {
      if (!params.collection || !params.doc_id || !params.fields) throw new Error('collection, doc_id, and fields required');
      const docFields = {};
      for (const [k, v] of Object.entries(params.fields)) {
        if (typeof v === 'string') docFields[k] = { stringValue: v };
        else if (typeof v === 'number') docFields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        else if (typeof v === 'boolean') docFields[k] = { booleanValue: v };
        else docFields[k] = { stringValue: JSON.stringify(v) };
      }
      const updateMask = params.update_mask || Object.keys(params.fields).map(f => `fields.${f}`).join('&updateMask.fieldPaths=');
      return firestoreApi('PATCH', creds.project_id, `/${params.collection}/${params.doc_id}?updateMask.fieldPaths=${updateMask}`, creds.access_token, { fields: docFields });
    },
    list_collections: async (params, creds) => {
      const parent = params.doc_path ? `/${params.doc_path}` : '';
      return firestoreApi('POST', creds.project_id, `${parent}:listCollectionIds`, creds.access_token, { pageSize: params.limit || 100 });
    },
    batch_get: async (params, creds) => {
      if (!params.documents || !Array.isArray(params.documents)) throw new Error('documents array required');
      const fullPaths = params.documents.map(d => `projects/${creds.project_id}/databases/(default)/documents/${d}`);
      const r = await firestoreApi('POST', creds.project_id, ':batchGet', creds.access_token, { documents: fullPaths });
      return (Array.isArray(r) ? r : []).filter(d => d.found).map(d => decodeDoc(d.found));
    },
    count_documents: async (params, creds) => {
      if (!params.collection) throw new Error('collection required');
      const structuredAggregation = { structuredQuery: { from: [{ collectionId: params.collection }] }, aggregations: [{ alias: 'count', count: {} }] };
      return firestoreApi('POST', creds.project_id, ':runAggregationQuery', creds.access_token, structuredAggregation);
    },
    list_subcollection_docs: async (params, creds) => {
      if (!params.path) throw new Error('full document path required (e.g. collection/doc/subcollection)');
      return firestoreApi('GET', creds.project_id, `/${params.path}?pageSize=${params.limit || 20}`, creds.access_token).then(r => (r.documents || []).map(decodeDoc));
    },
    begin_transaction: async (params, creds) => {
      return firestoreApi('POST', creds.project_id, ':beginTransaction', creds.access_token, { options: { readOnly: params.read_only ? {} : undefined } });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
