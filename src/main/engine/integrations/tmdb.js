/**
 * The Movie Database (TMDB) API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function tmdbGet(path, apiKey) {
  const opts = { method: 'GET', hostname: 'api.themoviedb.org', path: `/3${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'tmdb',
  name: 'TMDB',
  category: 'media',
  icon: 'Film',
  description: 'Search movies, TV shows, and people via The Movie Database (TMDB).',
  configFields: [{ key: 'api_key', label: 'API Read Access Token (v4 Bearer)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tmdbGet('/configuration', creds.api_key); if (r.status_code) return { success: false, message: r.status_message }; return { success: true, message: 'Connected to TMDB' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_movies: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, ...(params.year && { year: String(params.year) }), page: String(params.page || 1) }).toString();
      return tmdbGet(`/search/movie?${qs}`, creds.api_key);
    },
    get_movie: async (params, creds) => {
      if (!params.id) throw new Error('movie id required');
      const append = params.append || 'credits,videos,images';
      return tmdbGet(`/movie/${params.id}?append_to_response=${encodeURIComponent(append)}`, creds.api_key);
    },
    get_trending: async (params, creds) => {
      const type = params.media_type || 'all';
      const window = params.time_window || 'week';
      return tmdbGet(`/trending/${type}/${window}`, creds.api_key);
    },
    search_tv: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return tmdbGet(`/search/tv?query=${encodeURIComponent(params.query)}&page=${params.page || 1}`, creds.api_key);
    },
    get_person: async (params, creds) => {
      if (!params.id) throw new Error('person id required');
      return tmdbGet(`/person/${params.id}?append_to_response=movie_credits,tv_credits`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
