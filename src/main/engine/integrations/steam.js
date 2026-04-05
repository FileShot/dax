/**
 * Steam Web API Integration
 */
'use strict';
const https = require('https');

function steamRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.steampowered.com', path: `${path}${separator}key=${encodeURIComponent(apiKey)}&format=json` };
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
  id: 'steam',
  name: 'Steam',
  category: 'gaming',
  icon: 'Gamepad2',
  description: 'Access Steam player profiles, game libraries, achievements, and news.',
  configFields: [
    { key: 'api_key', label: 'Web API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await steamRequest('/ISteamWebAPIUtil/GetSupportedAPIList/v0001/', creds.api_key); return { success: !!r.apilist, message: 'Connected to Steam Web API' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_player_summaries: async (params, creds) => {
      if (!params.steamids) throw new Error('steamids required (comma-separated)');
      return steamRequest(`/ISteamUser/GetPlayerSummaries/v0002/?steamids=${encodeURIComponent(params.steamids)}`, creds.api_key);
    },
    get_owned_games: async (params, creds) => {
      if (!params.steamid) throw new Error('steamid required');
      return steamRequest(`/IPlayerService/GetOwnedGames/v0001/?steamid=${params.steamid}&include_appinfo=1&include_played_free_games=1`, creds.api_key);
    },
    get_achievements: async (params, creds) => {
      if (!params.steamid || !params.appid) throw new Error('steamid and appid required');
      return steamRequest(`/ISteamUserStats/GetPlayerAchievements/v0001/?steamid=${params.steamid}&appid=${params.appid}`, creds.api_key);
    },
    get_news: async (params, creds) => {
      if (!params.appid) throw new Error('appid required');
      return steamRequest(`/ISteamNews/GetNewsForApp/v0002/?appid=${params.appid}&count=${params.count || 5}&maxlength=${params.maxlength || 300}`, creds.api_key);
    },
    get_player_bans: async (params, creds) => {
      if (!params.steamids) throw new Error('steamids required');
      return steamRequest(`/ISteamUser/GetPlayerBans/v1/?steamids=${encodeURIComponent(params.steamids)}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
