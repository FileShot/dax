/**
 * Bybit V5 API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bybitReq(path) {
  return makeRequest({ method: 'GET', hostname: 'api.bybit.com', path, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'bybit',
  name: 'Bybit',
  category: 'blockchain',
  icon: 'CandlestickChart',
  description: 'Access Bybit cryptocurrency derivatives and spot market data.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bybitReq('/v5/market/time'); return { success: true, message: `Bybit server time: ${r.result?.timeNano || r.result?.timeSecond}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_tickers: async (params, creds) => {
      if (!params.category) throw new Error('category required (spot, linear, inverse, option)');
      const qs = params.symbol ? `&symbol=${params.symbol}` : '';
      return bybitReq(`/v5/market/tickers?category=${params.category}${qs}`);
    },
    get_kline: async (params, creds) => {
      if (!params.category || !params.symbol || !params.interval) throw new Error('category, symbol, and interval required');
      return bybitReq(`/v5/market/kline?category=${params.category}&symbol=${params.symbol}&interval=${params.interval}&limit=${params.limit || 50}`);
    },
    get_orderbook: async (params, creds) => {
      if (!params.category || !params.symbol) throw new Error('category and symbol required');
      return bybitReq(`/v5/market/orderbook?category=${params.category}&symbol=${params.symbol}&limit=${params.limit || 25}`);
    },
    get_instruments: async (params, creds) => {
      if (!params.category) throw new Error('category required');
      const qs = params.symbol ? `&symbol=${params.symbol}` : `&limit=${params.limit || 20}`;
      return bybitReq(`/v5/market/instruments-info?category=${params.category}${qs}`);
    },
    get_server_time: async (params, creds) => {
      return bybitReq('/v5/market/time');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
