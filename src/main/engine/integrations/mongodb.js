/**
 * MongoDB Atlas Data API Integration
 */
'use strict';
const https = require('https');

function mongoApi(endpoint, apiKey, body) {
  const url = new URL(endpoint);
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { method: 'POST', hostname: url.hostname, path: url.pathname, headers: { 'api-key': apiKey, 'Content-Type': 'application/ejson', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'mongodb',
  name: 'MongoDB Atlas',
  category: 'data',
  icon: 'Database',
  description: 'Query and manage MongoDB Atlas collections via the Data API.',
  configFields: [
    { key: 'endpoint', label: 'Data API Endpoint URL', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'data_source', label: 'Data Source Name', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.endpoint || !creds.api_key || !creds.data_source) throw new Error('Endpoint, API key, and data source required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) { return { success: true, message: 'MongoDB Data API configured (test on first query)' }; },
  actions: {
    find: async (params, creds) => {
      if (!params.database || !params.collection) throw new Error('database and collection required');
      return mongoApi(`${creds.endpoint}/action/find`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter || {}, limit: params.limit || 20, ...(params.sort ? { sort: params.sort } : {}), ...(params.projection ? { projection: params.projection } : {}) });
    },
    find_one: async (params, creds) => {
      if (!params.database || !params.collection) throw new Error('database and collection required');
      return mongoApi(`${creds.endpoint}/action/findOne`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter || {} });
    },
    insert_one: async (params, creds) => {
      if (!params.database || !params.collection || !params.document) throw new Error('database, collection, and document required');
      return mongoApi(`${creds.endpoint}/action/insertOne`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, document: params.document });
    },
    update_one: async (params, creds) => {
      if (!params.database || !params.collection || !params.filter || !params.update) throw new Error('database, collection, filter, and update required');
      return mongoApi(`${creds.endpoint}/action/updateOne`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter, update: params.update });
    },
    delete_one: async (params, creds) => {
      if (!params.database || !params.collection || !params.filter) throw new Error('database, collection, and filter required');
      return mongoApi(`${creds.endpoint}/action/deleteOne`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter });
    },
    aggregate: async (params, creds) => {
      if (!params.database || !params.collection || !params.pipeline) throw new Error('database, collection, and pipeline required');
      return mongoApi(`${creds.endpoint}/action/aggregate`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, pipeline: params.pipeline });
    },
    insert_many: async (params, creds) => {
      if (!params.database || !params.collection || !params.documents) throw new Error('database, collection, and documents array required');
      return mongoApi(`${creds.endpoint}/action/insertMany`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, documents: params.documents });
    },
    update_many: async (params, creds) => {
      if (!params.database || !params.collection || !params.filter || !params.update) throw new Error('database, collection, filter, and update required');
      return mongoApi(`${creds.endpoint}/action/updateMany`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter, update: params.update });
    },
    delete_many: async (params, creds) => {
      if (!params.database || !params.collection || !params.filter) throw new Error('database, collection, and filter required');
      return mongoApi(`${creds.endpoint}/action/deleteMany`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter });
    },
    replace_one: async (params, creds) => {
      if (!params.database || !params.collection || !params.filter || !params.replacement) throw new Error('database, collection, filter, and replacement required');
      return mongoApi(`${creds.endpoint}/action/replaceOne`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, filter: params.filter, replacement: params.replacement });
    },
    count_documents: async (params, creds) => {
      if (!params.database || !params.collection) throw new Error('database and collection required');
      return mongoApi(`${creds.endpoint}/action/aggregate`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, pipeline: [{ $match: params.filter || {} }, { $count: 'total' }] });
    },
    distinct: async (params, creds) => {
      if (!params.database || !params.collection || !params.field) throw new Error('database, collection, and field required');
      return mongoApi(`${creds.endpoint}/action/aggregate`, creds.api_key, { dataSource: creds.data_source, database: params.database, collection: params.collection, pipeline: [{ $match: params.filter || {} }, { $group: { _id: `$${params.field}` } }] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
