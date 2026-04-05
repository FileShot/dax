/**
 * Azure PlayFab Game Backend API Integration
 */
'use strict';
const https = require('https');

function playfabRequest(method, path, body, secretKey, titleId) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: `${titleId}.playfabapi.com`, path, headers: { 'X-SecretKey': secretKey, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'playfab',
  name: 'PlayFab',
  category: 'gaming',
  icon: 'Trophy',
  description: 'Manage game players, statistics, leaderboards, and virtual currency with Azure PlayFab.',
  configFields: [
    { key: 'title_id', label: 'Title ID', type: 'text', required: true },
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.title_id || !creds.secret_key) throw new Error('Title ID and secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await playfabRequest('POST', '/Admin/GetTitleData', {}, creds.secret_key, creds.title_id); return { success: r.code === 200, message: r.errorMessage || 'Connected to PlayFab' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_player_profile: async (params, creds) => {
      if (!params.playfab_id) throw new Error('playfab_id required');
      return playfabRequest('POST', '/Admin/GetPlayerProfile', { PlayFabId: params.playfab_id, ProfileConstraints: params.constraints || {} }, creds.secret_key, creds.title_id);
    },
    get_player_statistics: async (params, creds) => {
      if (!params.playfab_id) throw new Error('playfab_id required');
      return playfabRequest('POST', '/Server/GetPlayerStatistics', { PlayFabId: params.playfab_id, ...(params.statistics_names && { StatisticNames: params.statistics_names }) }, creds.secret_key, creds.title_id);
    },
    get_leaderboard: async (params, creds) => {
      if (!params.statistic_name) throw new Error('statistic_name required');
      return playfabRequest('POST', '/Server/GetLeaderboard', { StatisticName: params.statistic_name, StartPosition: params.start_position || 0, MaxResultsCount: params.max_results || 10 }, creds.secret_key, creds.title_id);
    },
    update_player_data: async (params, creds) => {
      if (!params.playfab_id || !params.data) throw new Error('playfab_id and data required');
      return playfabRequest('POST', '/Server/UpdateUserData', { PlayFabId: params.playfab_id, Data: params.data, Permission: params.permission || 'Public' }, creds.secret_key, creds.title_id);
    },
    add_virtual_currency: async (params, creds) => {
      if (!params.playfab_id || !params.currency_code || params.amount === undefined) throw new Error('playfab_id, currency_code, and amount required');
      return playfabRequest('POST', '/Server/AddUserVirtualCurrency', { PlayFabId: params.playfab_id, VirtualCurrency: params.currency_code, Amount: params.amount }, creds.secret_key, creds.title_id);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
