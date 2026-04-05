/**
 * Last.fm API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function lfmGet(method, params, apiKey) {
  const qs = new URLSearchParams({ method, api_key: apiKey, format: 'json', ...params }).toString();
  const opts = { method: 'GET', hostname: 'ws.audioscrobbler.com', path: `/2.0/?${qs}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'last-fm',
  name: 'Last.fm',
  category: 'media',
  icon: 'Headphones',
  description: 'Search artists, tracks, and albums; get music metadata and scrobbling data via Last.fm.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lfmGet('artist.search', { artist: 'radiohead', limit: '1' }, creds.api_key); if (r.error) return { success: false, message: r.message }; return { success: true, message: 'Connected to Last.fm' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_artists: async (params, creds) => {
      if (!params.artist) throw new Error('artist name required');
      return lfmGet('artist.search', { artist: params.artist, limit: String(params.limit || 10), page: String(params.page || 1) }, creds.api_key);
    },
    get_artist_info: async (params, creds) => {
      if (!params.artist) throw new Error('artist name required');
      return lfmGet('artist.getInfo', { artist: params.artist, autocorrect: '1' }, creds.api_key);
    },
    search_tracks: async (params, creds) => {
      if (!params.track) throw new Error('track name required');
      return lfmGet('track.search', { track: params.track, ...(params.artist && { artist: params.artist }), limit: String(params.limit || 10) }, creds.api_key);
    },
    get_track_info: async (params, creds) => {
      if (!params.track || !params.artist) throw new Error('track and artist required');
      return lfmGet('track.getInfo', { track: params.track, artist: params.artist, autocorrect: '1' }, creds.api_key);
    },
    get_similar_artists: async (params, creds) => {
      if (!params.artist) throw new Error('artist name required');
      return lfmGet('artist.getSimilar', { artist: params.artist, limit: String(params.limit || 10), autocorrect: '1' }, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
