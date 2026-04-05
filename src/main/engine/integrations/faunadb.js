/**
 * FaunaDB HTTP API Integration
 */
'use strict';
const https = require('https');

function faunaQuery(secret, fql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: fql });
    const opts = {
      method: 'POST',
      hostname: 'db.fauna.com',
      path: '/query/1',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Format': 'simple',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'faunadb',
  name: 'FaunaDB',
  category: 'database',
  icon: 'Leaf',
  description: 'Query Fauna serverless database with FQL or GraphQL.',
  configFields: [
    { key: 'secret', label: 'Database Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.secret) throw new Error('Database secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await faunaQuery(creds.secret, 'Now()'); return { success: !r.error, message: r.error ? r.error.code : 'Connected to Fauna' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query: async (params, creds) => { if (!params.fql) throw new Error('fql query required'); return faunaQuery(creds.secret, params.fql); },
    get_document: async (params, creds) => { if (!params.collection || !params.id) throw new Error('collection and id required'); return faunaQuery(creds.secret, `${params.collection}.byId("${params.id}")`); },
    create_document: async (params, creds) => { if (!params.collection || !params.data) throw new Error('collection and data required'); return faunaQuery(creds.secret, `${params.collection}.create(${JSON.stringify(params.data)})`); },
    paginate: async (params, creds) => {
      if (!params.collection) throw new Error('collection required');
      const size = params.size || 25;
      return faunaQuery(creds.secret, `Set.paginate(${params.collection}.all(), ${size})`);
    },
    delete_document: async (params, creds) => { if (!params.collection || !params.id) throw new Error('collection and id required'); return faunaQuery(creds.secret, `${params.collection}.byId("${params.id}").delete()`); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
