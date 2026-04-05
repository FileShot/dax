/**
 * CoinGecko Cryptocurrency API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function cgReq(path, creds) {
  const headers = { 'Accept': 'application/json' };
  if (creds && creds.api_key) headers['x-cg-demo-api-key'] = creds.api_key;
  return makeRequest({ method: 'GET', hostname: 'api.coingecko.com', path, headers }, null);
}

module.exports = {
  id: 'coingecko',
  name: 'CoinGecko',
  category: 'blockchain',
  icon: 'TrendingUp',
  description: 'Access cryptocurrency prices, market data, and coin information from CoinGecko.',
  configFields: [
    { key: 'api_key', label: 'API Key (optional, for higher rate limits)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cgReq('/api/v3/ping', creds); return { success: true, message: r.gecko_says || 'CoinGecko OK' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_price: async (params, creds) => {
      if (!params.ids || !params.vs_currencies) throw new Error('ids and vs_currencies required');
      return cgReq(`/api/v3/simple/price?ids=${params.ids}&vs_currencies=${params.vs_currencies}`, creds);
    },
    get_coin: async (params, creds) => {
      if (!params.id) throw new Error('coin id required');
      return cgReq(`/api/v3/coins/${params.id}?localization=false&tickers=false&community_data=false`, creds);
    },
    get_trending: async (params, creds) => {
      return cgReq('/api/v3/search/trending', creds);
    },
    get_market: async (params, creds) => {
      const vs = params.vs_currency || 'usd';
      const qs = `?vs_currency=${vs}&order=${params.order || 'market_cap_desc'}&per_page=${params.per_page || 20}&page=${params.page || 1}`;
      return cgReq(`/api/v3/coins/markets${qs}`, creds);
    },
    get_history: async (params, creds) => {
      if (!params.id || !params.date) throw new Error('id and date (dd-mm-yyyy) required');
      return cgReq(`/api/v3/coins/${params.id}/history?date=${params.date}&localization=false`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
