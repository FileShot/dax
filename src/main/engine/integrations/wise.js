/**
 * Wise (TransferWise) API Integration
 */
'use strict';
const https = require('https');

function wiseApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.transferwise.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'wise',
  name: 'Wise',
  category: 'finance',
  icon: 'ArrowRightLeft',
  description: 'Manage transfers, accounts, and exchange rates via Wise API.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'profile_id', label: 'Profile ID', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wiseApi('GET', '/v1/profiles', creds.api_token); return { success: Array.isArray(r), message: Array.isArray(r) ? `${r.length} profile(s) found` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_profiles: async (params, creds) => wiseApi('GET', '/v1/profiles', creds.api_token),
    get_exchange_rate: async (params, creds) => {
      if (!params.source || !params.target) throw new Error('source and target currency required');
      return wiseApi('GET', `/v1/rates?source=${params.source}&target=${params.target}`, creds.api_token);
    },
    list_balances: async (params, creds) => {
      const profileId = params.profile_id || creds.profile_id;
      if (!profileId) throw new Error('profile_id required');
      return wiseApi('GET', `/v4/profiles/${profileId}/balances?types=STANDARD`, creds.api_token);
    },
    list_transfers: async (params, creds) => {
      const profileId = params.profile_id || creds.profile_id;
      if (!profileId) throw new Error('profile_id required');
      return wiseApi('GET', `/v1/transfers?profile=${profileId}&limit=${params.limit || 20}&offset=${params.offset || 0}`, creds.api_token);
    },
    get_transfer: async (params, creds) => { if (!params.transfer_id) throw new Error('transfer_id required'); return wiseApi('GET', `/v1/transfers/${params.transfer_id}`, creds.api_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
