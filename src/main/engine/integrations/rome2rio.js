/**
 * Rome2rio Travel Routing API Integration
 */
'use strict';
const https = require('https');

function r2rGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'free.rome2rio.com', path: `/api/1.5/json${path}${sep}key=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'rome2rio',
  name: 'Rome2rio',
  category: 'travel',
  icon: 'Route',
  description: 'Find multi-modal travel routes (flight, train, bus, ferry) between any two places.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await r2rGet('/Search?oName=London&dName=Paris', creds.api_key); if (r.error || r.errorCode) return { success: false, message: r.errorMessage || 'API error' }; return { success: true, message: 'Connected to Rome2rio' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_routes: async (params, creds) => {
      if (!params.oName || !params.dName) throw new Error('oName (origin) and dName (destination) required');
      const qs = new URLSearchParams({ oName: params.oName, dName: params.dName, ...(params.oPos && { oPos: params.oPos }), ...(params.dPos && { dPos: params.dPos }), ...(params.currency && { currency: params.currency }) }).toString();
      return r2rGet(`/Search?${qs}`, creds.api_key);
    },
    get_departure: async (params, creds) => {
      if (!params.oName || !params.dName) throw new Error('oName and dName required');
      return r2rGet(`/Search?oName=${encodeURIComponent(params.oName)}&dName=${encodeURIComponent(params.dName)}`, creds.api_key);
    },
    get_arrival: async (params, creds) => {
      if (!params.oName || !params.dName) throw new Error('oName and dName required');
      return r2rGet(`/Search?oName=${encodeURIComponent(params.oName)}&dName=${encodeURIComponent(params.dName)}`, creds.api_key);
    },
    get_transit_options: async (params, creds) => {
      if (!params.oName || !params.dName) throw new Error('oName and dName required');
      const qs = new URLSearchParams({ oName: params.oName, dName: params.dName, ...(params.noAir && { noAir: '1' }) }).toString();
      return r2rGet(`/Search?${qs}`, creds.api_key);
    },
    get_pricing: async (params, creds) => {
      if (!params.oName || !params.dName) throw new Error('oName and dName required');
      const qs = new URLSearchParams({ oName: params.oName, dName: params.dName, currency: params.currency || 'USD' }).toString();
      return r2rGet(`/Search?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
