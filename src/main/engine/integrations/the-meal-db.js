/**
 * TheMealDB Recipe Database Integration
 */
'use strict';
const https = require('https');

function mealGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const key = apiKey || '1';
    const opts = { method: 'GET', hostname: 'www.themealdb.com', path: `/api/json/v1/${key}${path}`, headers: { 'Accept': 'application/json' } };
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
  id: 'the-meal-db',
  name: 'TheMealDB',
  category: 'food',
  icon: 'ChefHat',
  description: 'Free recipe database with meal info, categories, and random meal generator.',
  configFields: [{ key: 'api_key', label: 'API Key (use "1" for free tier)', type: 'text', required: false, default: '1' }],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mealGet('/search.php?s=chicken', creds.api_key); if (!r.meals && r.meals !== null) return { success: false, message: 'Unexpected response' }; return { success: true, message: 'Connected to TheMealDB' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_meals: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return mealGet(`/search.php?s=${encodeURIComponent(params.query)}`, creds.api_key);
    },
    get_meal: async (params, creds) => {
      if (!params.id) throw new Error('meal id required');
      return mealGet(`/lookup.php?i=${params.id}`, creds.api_key);
    },
    get_random: async (params, creds) => {
      return mealGet('/random.php', creds.api_key);
    },
    filter_by_category: async (params, creds) => {
      if (!params.category) throw new Error('category required');
      return mealGet(`/filter.php?c=${encodeURIComponent(params.category)}`, creds.api_key);
    },
    list_categories: async (params, creds) => {
      return mealGet('/categories.php', creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
