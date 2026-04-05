/**
 * iTunes Search API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function itunesGet(params) {
  const qs = new URLSearchParams({ ...params, media: params.media || 'all' }).toString();
  const opts = { method: 'GET', hostname: 'itunes.apple.com', path: `/search?${qs}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

function itunesLookup(params) {
  const qs = new URLSearchParams(params).toString();
  const opts = { method: 'GET', hostname: 'itunes.apple.com', path: `/lookup?${qs}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'itunes-search',
  name: 'iTunes Search',
  category: 'media',
  icon: 'Music4',
  description: 'Search the Apple iTunes catalog for music, apps, books, movies, and podcasts.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await itunesGet({ term: 'radiohead', limit: '1' }); if (r.resultCount !== undefined) return { success: true, message: 'Connected to iTunes Search API' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      return itunesGet({ term: params.query, limit: String(params.limit || 25), ...(params.media && { media: params.media }), ...(params.entity && { entity: params.entity }), ...(params.country && { country: params.country }) });
    },
    lookup: async (params, _creds) => {
      if (!params.id) throw new Error('iTunes id required');
      return itunesLookup({ id: params.id });
    },
    search_podcasts: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      return itunesGet({ term: params.query, media: 'podcast', limit: String(params.limit || 20) });
    },
    search_apps: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      return itunesGet({ term: params.query, media: 'software', limit: String(params.limit || 20) });
    },
    search_books: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      return itunesGet({ term: params.query, media: 'ebook', limit: String(params.limit || 20) });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
