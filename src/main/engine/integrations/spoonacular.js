/**
 * Spoonacular Recipe & Food API Integration
 */
'use strict';
const https = require('https');

function spoonGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.spoonacular.com', path: `${path}${sep}apiKey=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'spoonacular',
  name: 'Spoonacular',
  category: 'food',
  icon: 'UtensilsCrossed',
  description: 'Search recipes, get nutritional info, and find meal ideas via Spoonacular API.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await spoonGet('/food/ingredients/search?query=apple&number=1', creds.api_key); if (r.code === 402 || r.status === 'failure') return { success: false, message: r.message || 'API quota exceeded or key invalid' }; return { success: true, message: 'Connected to Spoonacular' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_recipes: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, number: String(params.number || 10), ...(params.diet && { diet: params.diet }), ...(params.cuisine && { cuisine: params.cuisine }), ...(params.maxReadyTime && { maxReadyTime: String(params.maxReadyTime) }) }).toString();
      return spoonGet(`/recipes/complexSearch?${qs}`, creds.api_key);
    },
    get_recipe: async (params, creds) => {
      if (!params.id) throw new Error('recipe id required');
      return spoonGet(`/recipes/${params.id}/information`, creds.api_key);
    },
    get_nutritional_info: async (params, creds) => {
      if (!params.id) throw new Error('recipe id required');
      return spoonGet(`/recipes/${params.id}/nutritionWidget.json`, creds.api_key);
    },
    search_ingredients: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return spoonGet(`/food/ingredients/search?query=${encodeURIComponent(params.query)}&number=${params.number || 10}`, creds.api_key);
    },
    get_meal_plan: async (params, creds) => {
      const qs = new URLSearchParams({ timeFrame: params.timeFrame || 'day', targetCalories: String(params.targetCalories || 2000), ...(params.diet && { diet: params.diet }) }).toString();
      return spoonGet(`/mealplanner/generate?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
