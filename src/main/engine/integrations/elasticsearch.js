/**
 * Elasticsearch REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function esApi(method, baseUrl, path, creds, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (creds.api_key) {
      headers['Authorization'] = `ApiKey ${creds.api_key}`;
    } else if (creds.username && creds.password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`;
    }
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 9200), path, headers };
    if (url.protocol === 'https:') opts.rejectUnauthorized = false;
    const req = mod.request(opts, (res) => {
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
  id: 'elasticsearch',
  name: 'Elasticsearch',
  category: 'search',
  icon: 'Database',
  description: 'Search, index, and manage data in Elasticsearch.',
  configFields: [
    { key: 'base_url', label: 'Elasticsearch URL', type: 'text', required: true, placeholder: 'http://localhost:9200' },
    { key: 'api_key', label: 'API Key (Base64)', type: 'password', required: false },
    { key: 'username', label: 'Username', type: 'text', required: false },
    { key: 'password', label: 'Password', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.base_url) throw new Error('Elasticsearch URL required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await esApi('GET', creds.base_url, '/', creds); return { success: !!r.cluster_name, message: r.cluster_name ? `Cluster: ${r.cluster_name}` : 'Connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.index) throw new Error('index required');
      const body = params.query ? { query: params.query, size: params.limit || 10 } : { query: { match_all: {} }, size: params.limit || 10 };
      return esApi('POST', creds.base_url, `/${encodeURIComponent(params.index)}/_search`, creds, body);
    },
    index_document: async (params, creds) => {
      if (!params.index || !params.document) throw new Error('index and document required');
      const path = params.doc_id ? `/${encodeURIComponent(params.index)}/_doc/${params.doc_id}` : `/${encodeURIComponent(params.index)}/_doc`;
      return esApi(params.doc_id ? 'PUT' : 'POST', creds.base_url, path, creds, params.document);
    },
    get_document: async (params, creds) => { if (!params.index || !params.doc_id) throw new Error('index and doc_id required'); return esApi('GET', creds.base_url, `/${encodeURIComponent(params.index)}/_doc/${params.doc_id}`, creds); },
    delete_document: async (params, creds) => { if (!params.index || !params.doc_id) throw new Error('index and doc_id required'); return esApi('DELETE', creds.base_url, `/${encodeURIComponent(params.index)}/_doc/${params.doc_id}`, creds); },
    list_indices: async (params, creds) => esApi('GET', creds.base_url, '/_cat/indices?format=json', creds),
    cluster_health: async (params, creds) => esApi('GET', creds.base_url, '/_cluster/health', creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
