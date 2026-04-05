/**
 * CoinMarketCap Crypto Market Data Integration
 */
'use strict';
const https = require('https');

function cmcRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'pro-api.coinmarketcap.com', path, headers: { 'X-CMC_PRO_API_KEY': apiKey, 'Accept': 'application/json' } };
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
  id: 'coinmarketcap',
  name: 'CoinMarketCap',
  category: 'finance',
  icon: 'ActivitySquare',
  description: 'Access cryptocurrency market data, rankings, and metrics via CoinMarketCap API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cmcRequest('/v1/key/info', creds.api_key); return { success: r.status?.error_code === 0, message: r.status?.error_message || 'Connected to CoinMarketCap' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_listings: async (params, creds) => {
      const qs = new URLSearchParams({ start: String(params.start || 1), limit: String(params.limit || 20), convert: params.convert || 'USD', ...(params.sort && { sort: params.sort }) }).toString();
      return cmcRequest(`/v1/cryptocurrency/listings/latest?${qs}`, creds.api_key);
    },
    get_quotes: async (params, creds) => {
      if (!params.symbol && !params.id) throw new Error('symbol or id required');
      const qs = new URLSearchParams({ ...(params.symbol && { symbol: params.symbol }), ...(params.id && { id: String(params.id) }), convert: params.convert || 'USD' }).toString();
      return cmcRequest(`/v2/cryptocurrency/quotes/latest?${qs}`, creds.api_key);
    },
    get_global_metrics: async (params, creds) => {
      return cmcRequest(`/v1/global-metrics/quotes/latest?convert=${params.convert || 'USD'}`, creds.api_key);
    },
    get_historical_quotes: async (params, creds) => {
      if (!params.symbol && !params.id) throw new Error('symbol or id required');
      const qs = new URLSearchParams({ ...(params.symbol && { symbol: params.symbol }), ...(params.id && { id: String(params.id) }), convert: params.convert || 'USD', count: String(params.count || 10), interval: params.interval || 'daily' }).toString();
      return cmcRequest(`/v2/cryptocurrency/quotes/historical?${qs}`, creds.api_key);
    },
    get_metadata: async (params, creds) => {
      if (!params.symbol && !params.id) throw new Error('symbol or id required');
      const qs = new URLSearchParams({ ...(params.symbol && { symbol: params.symbol }), ...(params.id && { id: String(params.id) }) }).toString();
      return cmcRequest(`/v2/cryptocurrency/info?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
