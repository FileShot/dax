/**
 * Polygon.io Market Data API Integration
 */
'use strict';
const https = require('https');

function polygonRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.polygon.io', path: `${path}${separator}apiKey=${encodeURIComponent(apiKey)}` };
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
  id: 'polygon-io',
  name: 'Polygon.io',
  category: 'finance',
  icon: 'BarChart2',
  description: 'Access real-time and historical stock, options, forex, and crypto market data from Polygon.io.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await polygonRequest('/v2/aggs/ticker/AAPL/range/1/day/2023-01-01/2023-01-05', creds.api_key); return { success: r.status === 'OK', message: r.message || r.status || 'Connected to Polygon.io' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_ticker: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      return polygonRequest(`/v3/reference/tickers/${params.symbol}`, creds.api_key);
    },
    list_tickers: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.market && { market: params.market }), ...(params.search && { search: params.search }), limit: String(params.limit || 20), active: String(params.active !== false) }).toString();
      return polygonRequest(`/v3/reference/tickers?${qs}`, creds.api_key);
    },
    get_aggregates: async (params, creds) => {
      if (!params.symbol || !params.from || !params.to) throw new Error('symbol, from, and to required');
      const multiplier = params.multiplier || 1;
      const timespan = params.timespan || 'day';
      return polygonRequest(`/v2/aggs/ticker/${params.symbol}/range/${multiplier}/${timespan}/${params.from}/${params.to}`, creds.api_key);
    },
    get_snapshot: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      return polygonRequest(`/v2/snapshot/locale/us/markets/stocks/tickers/${params.symbol}`, creds.api_key);
    },
    get_news: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.symbol && { ticker: params.symbol }), limit: String(params.limit || 10), ...(params.published_utc_gte && { 'published_utc.gte': params.published_utc_gte }) }).toString();
      return polygonRequest(`/v2/reference/news?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
