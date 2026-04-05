/**
 * Deezer API Integration (public endpoints, no auth for read)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function deezerGet(path) {
  const opts = { method: 'GET', hostname: 'api.deezer.com', path, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'deezer',
  name: 'Deezer',
  category: 'media',
  icon: 'Music',
  description: 'Search Deezer music catalog: tracks, albums, artists, and playlists.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await deezerGet('/search?q=radiohead&limit=1'); if (r.error) return { success: false, message: r.error.message }; return { success: true, message: 'Connected to Deezer' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ q: params.query, limit: String(params.limit || 25), index: String(params.index || 0), ...(params.type && { type: params.type }) }).toString();
      return deezerGet(`/search?${qs}`);
    },
    get_track: async (params, _creds) => {
      if (!params.id) throw new Error('track id required');
      return deezerGet(`/track/${params.id}`);
    },
    get_album: async (params, _creds) => {
      if (!params.id) throw new Error('album id required');
      return deezerGet(`/album/${params.id}`);
    },
    get_artist: async (params, _creds) => {
      if (!params.id) throw new Error('artist id required');
      return deezerGet(`/artist/${params.id}`);
    },
    get_playlist: async (params, _creds) => {
      if (!params.id) throw new Error('playlist id required');
      return deezerGet(`/playlist/${params.id}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
