/**
 * Musixmatch Lyrics API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function mmGet(method, params, apiKey) {
  const qs = new URLSearchParams({ ...params, apikey: apiKey, format: 'json' }).toString();
  const opts = { method: 'GET', hostname: 'api.musixmatch.com', path: `/ws/1.1/${method}?${qs}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'musixmatch',
  name: 'Musixmatch',
  category: 'media',
  icon: 'Mic2',
  description: 'Search song lyrics, track metadata, and artist info via the Musixmatch API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mmGet('track.search', { q_track: 'bohemian rhapsody', page_size: '1', page: '1', s_track_rating: 'desc' }, creds.api_key); if (r.message.header.status_code !== 200) return { success: false, message: `Status ${r.message.header.status_code}` }; return { success: true, message: 'Connected to Musixmatch' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_tracks: async (params, creds) => {
      if (!params.query && !params.artist) throw new Error('query or artist required');
      return mmGet('track.search', { ...(params.query && { q_track: params.query }), ...(params.artist && { q_artist: params.artist }), page_size: String(params.page_size || 10), page: String(params.page || 1), s_track_rating: 'desc' }, creds.api_key);
    },
    get_lyrics: async (params, creds) => {
      if (!params.track_id) throw new Error('track_id required');
      return mmGet('track.lyrics.get', { track_id: String(params.track_id) }, creds.api_key);
    },
    get_track: async (params, creds) => {
      if (!params.track_id) throw new Error('track_id required');
      return mmGet('track.get', { track_id: String(params.track_id) }, creds.api_key);
    },
    search_by_isrc: async (params, creds) => {
      if (!params.isrc) throw new Error('isrc required');
      return mmGet('track.get', { track_isrc: params.isrc }, creds.api_key);
    },
    get_artist_tracks: async (params, creds) => {
      if (!params.artist_id) throw new Error('artist_id required');
      return mmGet('artist.albums.get', { artist_id: String(params.artist_id), page: String(params.page || 1), page_size: String(params.page_size || 10), g_album_name: '1', s_release_date: 'desc' }, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
