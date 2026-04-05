/**
 * IGDB (Internet Games Database via Twitch) Integration
 */
'use strict';
const https = require('https');
const { TokenCache, makeRequest } = require('../../engine/integration-utils');
const _tokenCache = new TokenCache();

async function getToken(clientId, clientSecret) {
  const cacheKey = clientId;
  const cached = _tokenCache.get(cacheKey);
  if (cached) return cached;
  return new Promise((resolve, reject) => {
    const body = `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`;
    const opts = { method: 'POST', hostname: 'id.twitch.tv', path: '/oauth2/token', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { const r = JSON.parse(d); if (r.access_token) { _tokenCache.set(cacheKey, r.access_token, r.expires_in || 5183944); resolve(r.access_token); } else reject(new Error(r.message || 'Token failed')); } catch { reject(new Error('Token parse error')); } }); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function igdbPost(endpoint, body, token, clientId) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const opts = { method: 'POST', hostname: 'api.igdb.com', path: `/v4${endpoint}`, headers: { 'Authorization': `Bearer ${token}`, 'Client-ID': clientId, 'Accept': 'application/json', 'Content-Type': 'text/plain', 'Content-Length': Buffer.byteLength(bodyStr) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'igdb',
  name: 'IGDB',
  category: 'media',
  icon: 'Trophy',
  description: 'Access IGDB game database: search games, platforms, genres, and companies via Twitch OAuth.',
  configFields: [
    { key: 'client_id', label: 'Twitch Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Twitch Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('client_id and client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const token = await getToken(creds.client_id, creds.client_secret); const r = await igdbPost('/games', 'fields name,first_release_date; limit 1;', token, creds.client_id); if (Array.isArray(r)) return { success: true, message: 'Connected to IGDB' }; return { success: false, message: r.message || 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_games: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const token = await getToken(creds.client_id, creds.client_secret);
      const body = `search "${params.query}"; fields name,summary,rating,first_release_date,genres.name,platforms.name; limit ${params.limit || 10};`;
      return igdbPost('/games', body, token, creds.client_id);
    },
    get_game: async (params, creds) => {
      if (!params.id) throw new Error('game id required');
      const token = await getToken(creds.client_id, creds.client_secret);
      return igdbPost('/games', `fields *; where id = ${params.id}; limit 1;`, token, creds.client_id);
    },
    get_platforms: async (params, creds) => {
      const token = await getToken(creds.client_id, creds.client_secret);
      return igdbPost('/platforms', `fields name,summary; limit ${params.limit || 30};`, token, creds.client_id);
    },
    get_genres: async (params, creds) => {
      const token = await getToken(creds.client_id, creds.client_secret);
      return igdbPost('/genres', 'fields name; limit 50;', token, creds.client_id);
    },
    get_company: async (params, creds) => {
      if (!params.id && !params.name) throw new Error('id or name required');
      const token = await getToken(creds.client_id, creds.client_secret);
      const query = params.id ? `where id = ${params.id};` : `search "${params.name}";`;
      return igdbPost('/companies', `fields name,description,websites; ${query} limit 5;`, token, creds.client_id);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
