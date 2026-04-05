/**
 * Spotify Web API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function spotifyGet(path, accessToken) {
  const opts = { method: 'GET', hostname: 'api.spotify.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

function spotifyApi(method, path, accessToken, body) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.spotify.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'spotify',
  name: 'Spotify',
  category: 'social',
  icon: 'Music2',
  description: 'Access Spotify tracks, albums, playlists, and user library via the Web API.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await spotifyGet('/me', creds.access_token); if (r.error) return { success: false, message: r.error.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.display_name || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (_p, creds) => spotifyGet('/me', creds.access_token),
    search: async (params, creds) => {
      if (!params.q) throw new Error('q required');
      const qs = new URLSearchParams({ q: params.q, type: params.type || 'track,artist,album', limit: String(params.limit || 20) }).toString();
      return spotifyGet(`/search?${qs}`, creds.access_token);
    },
    get_track: async (params, creds) => {
      if (!params.track_id) throw new Error('track_id required');
      return spotifyGet(`/tracks/${params.track_id}`, creds.access_token);
    },
    get_playlist: async (params, creds) => {
      if (!params.playlist_id) throw new Error('playlist_id required');
      return spotifyGet(`/playlists/${params.playlist_id}`, creds.access_token);
    },
    get_user_playlists: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), offset: String(params.offset || 0) }).toString();
      return spotifyGet(`/me/playlists?${qs}`, creds.access_token);
    },
    get_artist: async (params, creds) => {
      if (!params.artist_id) throw new Error('artist_id required');
      return spotifyGet(`/artists/${params.artist_id}`, creds.access_token);
    },
    get_album: async (params, creds) => {
      if (!params.album_id) throw new Error('album_id required');
      return spotifyGet(`/albums/${params.album_id}`, creds.access_token);
    },
    get_recommendations: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.seed_tracks && { seed_tracks: params.seed_tracks }), ...(params.seed_artists && { seed_artists: params.seed_artists }), ...(params.seed_genres && { seed_genres: params.seed_genres }) }).toString();
      return spotifyGet(`/recommendations?${qs}`, creds.access_token);
    },
    get_saved_tracks: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), offset: String(params.offset || 0) }).toString();
      return spotifyGet(`/me/tracks?${qs}`, creds.access_token);
    },
    get_recently_played: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20) }).toString();
      return spotifyGet(`/me/player/recently-played?${qs}`, creds.access_token);
    },
    get_top_tracks: async (params, creds) => {
      const qs = new URLSearchParams({ time_range: params.time_range || 'medium_term', limit: String(params.limit || 20) }).toString();
      return spotifyGet(`/me/top/tracks?${qs}`, creds.access_token);
    },
    get_top_artists: async (params, creds) => {
      const qs = new URLSearchParams({ time_range: params.time_range || 'medium_term', limit: String(params.limit || 20) }).toString();
      return spotifyGet(`/me/top/artists?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
