/**
 * Binance Public API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bnReq(path) {
  return makeRequest({ method: 'GET', hostname: 'api.binance.com', path, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'binance',
  name: 'Binance',
  category: 'blockchain',
  icon: 'BarChart',
  description: 'Access Binance cryptocurrency exchange market data — prices, order books, and klines.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bnReq('/api/v3/time'); return { success: true, message: `Binance server time: ${r.serverTime}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_price: async (params, creds) => {
      const qs = params.symbol ? `?symbol=${params.symbol}` : '';
      return bnReq(`/api/v3/ticker/price${qs}`);
    },
    get_klines: async (params, creds) => {
      if (!params.symbol || !params.interval) throw new Error('symbol and interval required');
      return bnReq(`/api/v3/klines?symbol=${params.symbol}&interval=${params.interval}&limit=${params.limit || 100}`);
    },
    get_order_book: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      return bnReq(`/api/v3/depth?symbol=${params.symbol}&limit=${params.limit || 10}`);
    },
    get_24hr_ticker: async (params, creds) => {
      const qs = params.symbol ? `?symbol=${params.symbol}` : '';
      return bnReq(`/api/v3/ticker/24hr${qs}`);
    },
    get_exchange_info: async (params, creds) => {
      const qs = params.symbol ? `?symbol=${params.symbol}` : '';
      return bnReq(`/api/v3/exchangeInfo${qs}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
