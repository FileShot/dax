/**
 * Twelve Data Market Data Integration
 */
'use strict';
const https = require('https');

function tdGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.twelvedata.com', path: `${path}${sep}apikey=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'twelvedata',
  name: 'Twelve Data',
  category: 'finance',
  icon: 'TrendingUp',
  description: 'Access real-time and historical stock, forex, and crypto market data via Twelve Data.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await tdGet('/api_usage', creds.api_key); if (r.code && r.code !== 200) return { success: false, message: r.message || 'Auth failed' }; return { success: true, message: 'Connected to Twelve Data' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_time_series: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      const qs = new URLSearchParams({ symbol: params.symbol, interval: params.interval || '1day', outputsize: String(params.outputsize || 30), ...(params.start_date && { start_date: params.start_date }), ...(params.end_date && { end_date: params.end_date }) }).toString();
      return tdGet(`/time_series?${qs}`, creds.api_key);
    },
    get_quote: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      return tdGet(`/quote?symbol=${encodeURIComponent(params.symbol)}`, creds.api_key);
    },
    get_price: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      return tdGet(`/price?symbol=${encodeURIComponent(params.symbol)}`, creds.api_key);
    },
    get_exchange_rate: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required (e.g., EUR/USD)');
      return tdGet(`/exchange_rate?symbol=${encodeURIComponent(params.symbol)}`, creds.api_key);
    },
    list_stocks: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.symbol && { symbol: params.symbol }), ...(params.exchange && { exchange: params.exchange }), ...(params.country && { country: params.country }) }).toString();
      return tdGet(`/stocks?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
