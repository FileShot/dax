/**
 * OMDB API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function omdbGet(params, apiKey) {
  const qs = new URLSearchParams({ ...params, apikey: apiKey, r: 'json' }).toString();
  const opts = { method: 'GET', hostname: 'www.omdbapi.com', path: `/?${qs}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'omdb',
  name: 'OMDB',
  category: 'media',
  icon: 'Clapperboard',
  description: 'Look up movies and TV shows by title or IMDB ID using the OMDB API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await omdbGet({ t: 'Inception' }, creds.api_key); if (r.Response === 'False') return { success: false, message: r.Error }; return { success: true, message: `Connected to OMDB — found: ${r.Title}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return omdbGet({ s: params.query, type: params.type || '', y: params.year || '', page: String(params.page || 1) }, creds.api_key);
    },
    get_by_title: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return omdbGet({ t: params.title, ...(params.year && { y: String(params.year) }), ...(params.plot && { plot: params.plot }), type: params.type || '' }, creds.api_key);
    },
    get_by_imdb_id: async (params, creds) => {
      if (!params.id) throw new Error('IMDB id required (e.g. tt1375666)');
      return omdbGet({ i: params.id, ...(params.plot && { plot: params.plot }) }, creds.api_key);
    },
    get_season: async (params, creds) => {
      if (!params.title && !params.id) throw new Error('title or IMDB id required');
      if (!params.season) throw new Error('season number required');
      const base = params.id ? { i: params.id } : { t: params.title };
      return omdbGet({ ...base, Season: String(params.season) }, creds.api_key);
    },
    get_episode: async (params, creds) => {
      if (!params.title && !params.id) throw new Error('title or IMDB id required');
      if (!params.season || !params.episode) throw new Error('season and episode required');
      const base = params.id ? { i: params.id } : { t: params.title };
      return omdbGet({ ...base, Season: String(params.season), Episode: String(params.episode) }, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
