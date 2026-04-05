/**
 * Readwise Integration
 */
'use strict';
const https = require('https');

function readwiseRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'readwise.io', path, headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'readwise',
  name: 'Readwise',
  category: 'news',
  icon: 'BookOpen',
  description: 'Access and sync highlights, books, and articles from Readwise.',
  configFields: [
    { key: 'token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await readwiseRequest('GET', '/api/v2/auth/', null, creds.token); return { success: r.userEmail !== undefined || r.detail === undefined, message: r.detail || `Connected — ${r.userEmail || 'authenticated'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_highlights: async (params, creds) => {
      const qs = new URLSearchParams({ page_size: String(params.page_size || 20), ...(params.page && { page: String(params.page) }), ...(params.book_id && { book_id: String(params.book_id) }), ...(params.updated__gt && { updated__gt: params.updated__gt }) }).toString();
      return readwiseRequest('GET', `/api/v2/highlights/?${qs}`, null, creds.token);
    },
    add_highlights: async (params, creds) => {
      if (!params.highlights || !Array.isArray(params.highlights)) throw new Error('highlights array required');
      return readwiseRequest('POST', '/api/v2/highlights/', { highlights: params.highlights }, creds.token);
    },
    list_books: async (params, creds) => {
      const qs = new URLSearchParams({ page_size: String(params.page_size || 20), ...(params.category && { category: params.category }), ...(params.page && { page: String(params.page) }) }).toString();
      return readwiseRequest('GET', `/api/v2/books/?${qs}`, null, creds.token);
    },
    get_book: async (params, creds) => {
      if (!params.book_id) throw new Error('book_id required');
      return readwiseRequest('GET', `/api/v2/books/${params.book_id}/`, null, creds.token);
    },
    list_reader_documents: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.location && { location: params.location }), ...(params.category && { category: params.category }), ...(params.updated_after && { updatedAfter: params.updated_after }), ...(params.page_cursor && { pageCursor: params.page_cursor }) }).toString();
      return readwiseRequest('GET', `/api/v3/list/?${qs}`, null, creds.token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
