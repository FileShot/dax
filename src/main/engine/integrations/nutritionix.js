/**
 * Nutritionix Nutrition API Integration
 */
'use strict';
const https = require('https');

function nixReq(method, path, body, creds) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: 'trackapi.nutritionix.com', path: `/v2${path}`,
      headers: { 'Accept': 'application/json', 'x-app-id': creds.app_id, 'x-app-key': creds.app_key, ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'nutritionix',
  name: 'Nutritionix',
  category: 'food',
  icon: 'Apple',
  description: 'Natural language nutrition lookups, food search, and exercise calorie data.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
    { key: 'app_key', label: 'App Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.app_key) throw new Error('app_id and app_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await nixReq('GET', '/search/instant?query=apple', null, creds); if (r.message) return { success: false, message: r.message }; return { success: true, message: 'Connected to Nutritionix' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    natural_nutrients: async (params, creds) => {
      if (!params.query) throw new Error('query required (natural language, e.g. "1 cup of oatmeal")');
      return nixReq('POST', '/natural/nutrients', { query: params.query }, creds);
    },
    search_instant: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return nixReq('GET', `/search/instant?query=${encodeURIComponent(params.query)}&branded=${params.branded !== false}`, null, creds);
    },
    get_item: async (params, creds) => {
      if (!params.nix_item_id && !params.upc) throw new Error('nix_item_id or upc required');
      const qs = params.nix_item_id ? `nix_item_id=${params.nix_item_id}` : `upc=${params.upc}`;
      return nixReq('GET', `/search/item?${qs}`, null, creds);
    },
    exercise: async (params, creds) => {
      if (!params.query) throw new Error('query required (natural language, e.g. "ran 3 miles")');
      const body = { query: params.query, ...(params.weight_kg && { weight_kg: params.weight_kg }), ...(params.height_cm && { height_cm: params.height_cm }), ...(params.age && { age: params.age }) };
      return nixReq('POST', '/natural/exercise', body, creds);
    },
    get_branded_item: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return nixReq('GET', `/search/instant?query=${encodeURIComponent(params.query)}&branded=true&self=false`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
