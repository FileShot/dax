/**
 * Edamam Recipe & Nutrition API Integration
 */
'use strict';
const https = require('https');

function edamamGet(hostname, path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname, path, headers: { 'Accept': 'application/json' } };
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
  id: 'edamam',
  name: 'Edamam',
  category: 'food',
  icon: 'Salad',
  description: 'Search recipes and analyze nutrition data using Edamam API.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
    { key: 'app_key', label: 'App Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.app_key) throw new Error('app_id and app_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await edamamGet('api.edamam.com', `/api/recipes/v2?type=public&q=chicken&app_id=${creds.app_id}&app_key=${creds.app_key}&to=1`); if (r.status === 'error' || (r.message && r.message.includes('forbidden'))) return { success: false, message: r.message || 'Authentication failed' }; return { success: true, message: 'Connected to Edamam' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_recipes: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ type: 'public', q: params.query, app_id: creds.app_id, app_key: creds.app_key, from: String(params.from || 0), to: String(params.to || 10), ...(params.diet && { diet: params.diet }), ...(params.health && { health: params.health }) }).toString();
      return edamamGet('api.edamam.com', `/api/recipes/v2?${qs}`);
    },
    analyze_nutrition: async (params, creds) => {
      if (!params.ingredients || !Array.isArray(params.ingredients)) throw new Error('ingredients array required');
      return new Promise((resolve, reject) => {
        const body = JSON.stringify({ ingr: params.ingredients });
        const opts = { method: 'POST', hostname: 'api.edamam.com', path: `/api/nutrition-details?app_id=${creds.app_id}&app_key=${creds.app_key}`, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    },
    search_food: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ app_id: creds.app_id, app_key: creds.app_key, ingr: params.query, ...(params.nutrition_type && { 'nutrition-type': params.nutrition_type }) }).toString();
      return edamamGet('api.edamam.com', `/api/food-database/v2/parser?${qs}`);
    },
    get_food_database: async (params, creds) => {
      if (!params.food_id) throw new Error('food_id required');
      const qs = new URLSearchParams({ app_id: creds.app_id, app_key: creds.app_key, ...(params.measure_uri && { measureURI: params.measure_uri }) }).toString();
      return edamamGet('api.edamam.com', `/api/food-database/v2/nutrients?${qs}`);
    },
    parse_ingredients: async (params, creds) => {
      if (!params.ingredient) throw new Error('ingredient required');
      const qs = new URLSearchParams({ app_id: creds.app_id, app_key: creds.app_key, ingr: params.ingredient }).toString();
      return edamamGet('api.edamam.com', `/api/food-database/v2/parser?${qs}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
