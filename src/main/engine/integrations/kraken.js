/**
 * Kraken Cryptocurrency Exchange API Integration
 */
'use strict';
const crypto = require('crypto');
const { makeRequest } = require('../../engine/integration-utils');

function krPublic(path) {
  return makeRequest({ method: 'GET', hostname: 'api.kraken.com', path, headers: { 'Accept': 'application/json' } }, null);
}

async function krPrivate(path, params, creds) {
  if (!creds.api_key || !creds.api_secret) throw new Error('api_key and api_secret required for private endpoints');
  const nonce = Date.now().toString();
  const body = new URLSearchParams({ nonce, ...params }).toString();
  const hash = crypto.createHash('sha256').update(nonce + body).digest('binary');
  const secret = Buffer.from(creds.api_secret, 'base64');
  const mac = crypto.createHmac('sha512', secret).update(path + hash, 'binary').digest('base64');
  return makeRequest({ method: 'POST', hostname: 'api.kraken.com', path, headers: { 'API-Key': creds.api_key, 'API-Sign': mac, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
}

module.exports = {
  id: 'kraken',
  name: 'Kraken',
  category: 'blockchain',
  icon: 'DollarSign',
  description: 'Access Kraken cryptocurrency exchange market data and account information.',
  configFields: [
    { key: 'api_key', label: 'API Key (optional, for private endpoints)', type: 'text', required: false },
    { key: 'api_secret', label: 'API Secret (optional)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await krPublic('/0/public/Time'); return { success: true, message: `Kraken server time: ${r.result?.unixtime}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_ticker: async (params, creds) => {
      if (!params.pair) throw new Error('pair required (e.g. XBTUSD)');
      return krPublic(`/0/public/Ticker?pair=${params.pair}`);
    },
    get_ohlc: async (params, creds) => {
      if (!params.pair) throw new Error('pair required');
      return krPublic(`/0/public/OHLC?pair=${params.pair}&interval=${params.interval || 60}`);
    },
    get_order_book: async (params, creds) => {
      if (!params.pair) throw new Error('pair required');
      return krPublic(`/0/public/Depth?pair=${params.pair}&count=${params.count || 10}`);
    },
    get_asset_pairs: async (params, creds) => {
      const qs = params.pair ? `?pair=${params.pair}` : '';
      return krPublic(`/0/public/AssetPairs${qs}`);
    },
    get_server_time: async (params, creds) => {
      return krPublic('/0/public/Time');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
