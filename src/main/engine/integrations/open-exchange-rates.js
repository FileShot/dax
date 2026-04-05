/**
 * Open Exchange Rates Currency Data Integration
 */
'use strict';
const https = require('https');

function oxrGet(path, appId) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'openexchangerates.org', path: `/api${path}${path.includes('?') ? '&' : '?'}app_id=${appId}`, headers: { 'Accept': 'application/json' } };
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
  id: 'open-exchange-rates',
  name: 'Open Exchange Rates',
  category: 'finance',
  icon: 'RefreshCw',
  description: 'Get real-time, historical, and currency conversion data via Open Exchange Rates.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id) throw new Error('App ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await oxrGet('/usage.json', creds.app_id); if (r.error) return { success: false, message: r.description || r.error }; return { success: true, message: `Connected — plan: ${r.data?.plan?.name || 'unknown'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_latest: async (params, creds) => {
      const qs = params.base ? `?base=${params.base}` : '';
      return oxrGet(`/latest.json${qs}`, creds.app_id);
    },
    convert: async (params, creds) => {
      if (!params.from || !params.to || params.value == null) throw new Error('from, to, and value required');
      return oxrGet(`/convert/${params.value}/${params.from}/${params.to}`, creds.app_id);
    },
    get_historical: async (params, creds) => {
      if (!params.date) throw new Error('date required (YYYY-MM-DD)');
      const qs = params.base ? `?base=${params.base}` : '';
      return oxrGet(`/historical/${params.date}.json${qs}`, creds.app_id);
    },
    list_currencies: async (_params, creds) => {
      return oxrGet('/currencies.json', creds.app_id);
    },
    get_time_series: async (params, creds) => {
      if (!params.start || !params.end) throw new Error('start and end dates required (YYYY-MM-DD)');
      const qs = new URLSearchParams({ start: params.start, end: params.end, ...(params.base && { base: params.base }), ...(params.symbols && { symbols: params.symbols }) }).toString();
      return oxrGet(`/time-series.json?${qs}`, creds.app_id);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
