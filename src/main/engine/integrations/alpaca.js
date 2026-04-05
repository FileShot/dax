/**
 * Alpaca Stock/Crypto Trading API Integration
 */
'use strict';
const https = require('https');

function alpacaRequest(method, path, body, apiKeyId, apiSecretKey, isPaper) {
  return new Promise((resolve, reject) => {
    const hostname = isPaper ? 'paper-api.alpaca.markets' : 'api.alpaca.markets';
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname, path: `/v2${path}`, headers: { 'APCA-API-KEY-ID': apiKeyId, 'APCA-API-SECRET-KEY': apiSecretKey, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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

function alpacaData(path, apiKeyId, apiSecretKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'data.alpaca.markets', path: `/v2${path}`, headers: { 'APCA-API-KEY-ID': apiKeyId, 'APCA-API-SECRET-KEY': apiSecretKey } };
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
  id: 'alpaca',
  name: 'Alpaca',
  category: 'finance',
  icon: 'TrendingUp',
  description: 'Trade stocks and crypto, manage portfolios, and access market data via Alpaca Trading API.',
  configFields: [
    { key: 'api_key_id', label: 'API Key ID', type: 'text', required: true },
    { key: 'api_secret_key', label: 'API Secret Key', type: 'password', required: true },
    { key: 'paper_trading', label: 'Paper Trading', type: 'select', options: ['true', 'false'], required: false },
  ],
  async connect(creds) { if (!creds.api_key_id || !creds.api_secret_key) throw new Error('API key ID and secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await alpacaRequest('GET', '/account', null, creds.api_key_id, creds.api_secret_key, creds.paper_trading !== 'false'); return { success: !!r.id, message: r.message || `Connected — ${r.account_number || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_account: async (params, creds) => {
      return alpacaRequest('GET', '/account', null, creds.api_key_id, creds.api_secret_key, creds.paper_trading !== 'false');
    },
    list_positions: async (params, creds) => {
      return alpacaRequest('GET', '/positions', null, creds.api_key_id, creds.api_secret_key, creds.paper_trading !== 'false');
    },
    list_orders: async (params, creds) => {
      const qs = `?status=${params.status || 'open'}&limit=${params.limit || 20}`;
      return alpacaRequest('GET', `/orders${qs}`, null, creds.api_key_id, creds.api_secret_key, creds.paper_trading !== 'false');
    },
    place_order: async (params, creds) => {
      if (!params.symbol || !params.qty || !params.side || !params.type) throw new Error('symbol, qty, side, and type required');
      const body = { symbol: params.symbol, qty: String(params.qty), side: params.side, type: params.type, time_in_force: params.time_in_force || 'gtc', ...(params.limit_price && { limit_price: String(params.limit_price) }) };
      return alpacaRequest('POST', '/orders', body, creds.api_key_id, creds.api_secret_key, creds.paper_trading !== 'false');
    },
    get_bars: async (params, creds) => {
      if (!params.symbol) throw new Error('symbol required');
      const qs = `?symbols=${params.symbol}&timeframe=${params.timeframe || '1Day'}&limit=${params.limit || 20}`;
      return alpacaData(`/stocks/bars${qs}`, creds.api_key_id, creds.api_secret_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
