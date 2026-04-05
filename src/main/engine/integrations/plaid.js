/**
 * Plaid Financial Data API Integration
 */
'use strict';
const https = require('https');

function plaidApi(path, clientId, secret, env, body) {
  return new Promise((resolve, reject) => {
    const hostMap = { sandbox: 'sandbox.plaid.com', development: 'development.plaid.com', production: 'production.plaid.com' };
    const hostname = hostMap[env] || hostMap.sandbox;
    const payload = JSON.stringify({ client_id: clientId, secret, ...body });
    const opts = { method: 'POST', hostname, path, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  id: 'plaid',
  name: 'Plaid',
  category: 'finance',
  icon: 'Landmark',
  description: 'Access bank accounts, transactions, and identity data via Plaid.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'secret', label: 'Secret', type: 'password', required: true },
    { key: 'environment', label: 'Environment', type: 'text', required: false, placeholder: 'sandbox' },
  ],
  async connect(creds) { if (!creds.client_id || !creds.secret) throw new Error('Client ID and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await plaidApi('/institutions/get', creds.client_id, creds.secret, creds.environment || 'sandbox', { count: 1, offset: 0, country_codes: ['US'] }); return { success: !!r.institutions, message: r.institutions ? 'Connected to Plaid' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_transactions: async (params, creds) => {
      if (!params.access_token) throw new Error('access_token (item) required');
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const end = params.end_date || new Date().toISOString().slice(0, 10);
      return plaidApi('/transactions/get', creds.client_id, creds.secret, creds.environment || 'sandbox', { access_token: params.access_token, start_date: start, end_date: end, options: { count: params.limit || 100 } });
    },
    get_accounts: async (params, creds) => {
      if (!params.access_token) throw new Error('access_token (item) required');
      return plaidApi('/accounts/get', creds.client_id, creds.secret, creds.environment || 'sandbox', { access_token: params.access_token });
    },
    get_balance: async (params, creds) => {
      if (!params.access_token) throw new Error('access_token (item) required');
      return plaidApi('/accounts/balance/get', creds.client_id, creds.secret, creds.environment || 'sandbox', { access_token: params.access_token });
    },
    get_identity: async (params, creds) => {
      if (!params.access_token) throw new Error('access_token (item) required');
      return plaidApi('/identity/get', creds.client_id, creds.secret, creds.environment || 'sandbox', { access_token: params.access_token });
    },
    list_institutions: async (params, creds) => plaidApi('/institutions/get', creds.client_id, creds.secret, creds.environment || 'sandbox', { count: params.limit || 20, offset: params.offset || 0, country_codes: params.country_codes || ['US'] }),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
