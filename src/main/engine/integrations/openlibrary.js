/**
 * Open Library API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function olGet(path) {
  const opts = { method: 'GET', hostname: 'openlibrary.org', path, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'openlibrary',
  name: 'Open Library',
  category: 'media',
  icon: 'BookOpen',
  description: 'Search books, authors, and subjects from the Internet Archive Open Library.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await olGet('/search.json?q=hobbit&limit=1'); if (r.numFound !== undefined) return { success: true, message: 'Connected to Open Library' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_books: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ q: params.query, limit: String(params.limit || 20), page: String(params.page || 1), ...(params.fields && { fields: params.fields }) }).toString();
      return olGet(`/search.json?${qs}`);
    },
    get_book: async (params, _creds) => {
      if (!params.key) throw new Error('key required (e.g. /works/OL45883W or ISBN)');
      const path = params.key.startsWith('/') ? params.key : `/isbn/${params.key}`;
      return olGet(`${path}.json`);
    },
    get_author: async (params, _creds) => {
      if (!params.key) throw new Error('author key required (e.g. /authors/OL23919A)');
      return olGet(`${params.key}.json`);
    },
    search_subjects: async (params, _creds) => {
      if (!params.subject) throw new Error('subject required');
      return olGet(`/subjects/${encodeURIComponent(params.subject.toLowerCase().replace(/ /g, '_'))}.json?limit=${params.limit || 20}`);
    },
    get_cover: async (params, _creds) => {
      if (!params.isbn) throw new Error('isbn required');
      return { url: `https://covers.openlibrary.org/b/isbn/${params.isbn}-L.jpg` };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
