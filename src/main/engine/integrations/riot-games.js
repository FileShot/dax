/**
 * Riot Games API Integration
 */
'use strict';
const https = require('https');

function riotRequest(path, apiKey, region) {
  return new Promise((resolve, reject) => {
    const hostname = `${region || 'na1'}.api.riotgames.com`;
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname, path: `${path}${separator}api_key=${encodeURIComponent(apiKey)}` };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function riotRegionalRequest(path, apiKey, region) {
  return new Promise((resolve, reject) => {
    const hostname = `${region || 'americas'}.api.riotgames.com`;
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname, path: `${path}${separator}api_key=${encodeURIComponent(apiKey)}` };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'riot-games',
  name: 'Riot Games',
  category: 'gaming',
  icon: 'Swords',
  description: 'Access League of Legends and Valorant player data via the Riot Games API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'region', label: 'Region (e.g. na1, euw1, kr)', type: 'text', required: false },
    { key: 'regional_cluster', label: 'Regional Cluster (e.g. americas, europe, asia)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await riotRequest('/lol/status/v4/platform-data', creds.api_key, creds.region); return { success: !!r.id, message: r.status?.message || `Connected — ${r.name || 'Riot Games API'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_summoner_by_name: async (params, creds) => {
      if (!params.summoner_name) throw new Error('summoner_name required');
      return riotRequest(`/lol/summoner/v4/summoners/by-name/${encodeURIComponent(params.summoner_name)}`, creds.api_key, creds.region);
    },
    get_league_entries: async (params, creds) => {
      if (!params.summoner_id) throw new Error('summoner_id required');
      return riotRequest(`/lol/league/v4/entries/by-summoner/${params.summoner_id}`, creds.api_key, creds.region);
    },
    get_match_history: async (params, creds) => {
      if (!params.puuid) throw new Error('puuid required');
      const qs = `?start=0&count=${params.count || 5}`;
      return riotRegionalRequest(`/lol/match/v5/matches/by-puuid/${params.puuid}/ids${qs}`, creds.api_key, creds.regional_cluster || 'americas');
    },
    get_match: async (params, creds) => {
      if (!params.match_id) throw new Error('match_id required');
      return riotRegionalRequest(`/lol/match/v5/matches/${params.match_id}`, creds.api_key, creds.regional_cluster || 'americas');
    },
    get_platform_status: async (params, creds) => {
      return riotRequest('/lol/status/v4/platform-data', creds.api_key, creds.region);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
