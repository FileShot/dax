/**
 * RAWG Video Games API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function rawgGet(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.rawg.io', path: `/api${path}${sep}key=${apiKey}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'rawg',
  name: 'RAWG',
  category: 'media',
  icon: 'Gamepad2',
  description: 'Search video games, get details, genres, developers, and screenshots from RAWG.',
  configFields: [{ key: 'api_key', label: 'API Key (register at rawg.io/apidocs)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rawgGet('/games?page_size=1', creds.api_key); if (r.detail) return { success: false, message: r.detail }; return { success: true, message: 'Connected to RAWG' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_games: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ search: params.query, page_size: String(params.page_size || 20), page: String(params.page || 1), ...(params.genres && { genres: params.genres }), ...(params.platforms && { platforms: params.platforms }), ...(params.ordering && { ordering: params.ordering }) }).toString();
      return rawgGet(`/games?${qs}`, creds.api_key);
    },
    get_game: async (params, creds) => {
      if (!params.id) throw new Error('game id or slug required');
      return rawgGet(`/games/${params.id}`, creds.api_key);
    },
    get_genres: async (params, creds) => {
      return rawgGet(`/genres?page_size=${params.page_size || 20}`, creds.api_key);
    },
    list_developers: async (params, creds) => {
      return rawgGet(`/developers?page_size=${params.page_size || 20}&page=${params.page || 1}`, creds.api_key);
    },
    get_screenshots: async (params, creds) => {
      if (!params.id) throw new Error('game id required');
      return rawgGet(`/games/${params.id}/screenshots`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
