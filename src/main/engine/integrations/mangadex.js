/**
 * MangaDex API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function mdGet(path) {
  const opts = { method: 'GET', hostname: 'api.mangadex.org', path, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'mangadex',
  name: 'MangaDex',
  category: 'media',
  icon: 'BookMarked',
  description: 'Search manga titles, chapters, and covers from the MangaDex library.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await mdGet('/manga?limit=1'); if (r.result === 'error') return { success: false, message: r.errors[0]?.detail || 'Error' }; return { success: true, message: 'Connected to MangaDex' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_manga: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ title: params.query, limit: String(params.limit || 10), offset: String(params.offset || 0), ...(params.status && { status: params.status }), ...(params.content_rating && { contentRating: params.content_rating }) }).toString();
      return mdGet(`/manga?${qs}`);
    },
    get_manga: async (params, _creds) => {
      if (!params.id) throw new Error('manga id (UUID) required');
      return mdGet(`/manga/${params.id}`);
    },
    get_chapters: async (params, _creds) => {
      if (!params.manga_id) throw new Error('manga_id required');
      const qs = new URLSearchParams({ manga: params.manga_id, limit: String(params.limit || 20), offset: String(params.offset || 0), ...(params.language && { 'translatedLanguage[]': params.language }), 'order[chapter]': params.order || 'asc' }).toString();
      return mdGet(`/chapter?${qs}`);
    },
    get_cover: async (params, _creds) => {
      if (!params.manga_id) throw new Error('manga_id required');
      return mdGet(`/cover?manga[]=${params.manga_id}&limit=${params.limit || 10}`);
    },
    list_genres: async (params, _creds) => {
      return mdGet('/manga/tag');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
