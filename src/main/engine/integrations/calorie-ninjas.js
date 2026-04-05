/**
 * CalorieNinjas API Integration
 */
'use strict';
const https = require('https');

function ninjaGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.calorieninjas.com', path: `/v1${path}`, headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' } };
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
  id: 'calorie-ninjas',
  name: 'CalorieNinjas',
  category: 'food',
  icon: 'Flame',
  description: 'Get nutrition data for foods, vitamins, BMI, body fat, and activity calories.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ninjaGet('/nutrition?query=apple', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to CalorieNinjas' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_nutrition: async (params, creds) => {
      if (!params.query) throw new Error('query required (natural language, e.g. "1 cup rice and 2 eggs")');
      return ninjaGet(`/nutrition?query=${encodeURIComponent(params.query)}`, creds.api_key);
    },
    get_vitamins: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return ninjaGet(`/vitamins?query=${encodeURIComponent(params.query)}`, creds.api_key);
    },
    get_activity: async (params, creds) => {
      if (!params.activity) throw new Error('activity required (e.g. "running")');
      const qs = new URLSearchParams({ activity: params.activity, ...(params.duration && { duration: String(params.duration) }), ...(params.weight && { weight: String(params.weight) }) }).toString();
      return ninjaGet(`/caloriesburned?${qs}`, creds.api_key);
    },
    get_bmi: async (params, creds) => {
      if (!params.weight || !params.height) throw new Error('weight (kg) and height (cm) required');
      return ninjaGet(`/bmi?weight=${params.weight}&height=${params.height}`, creds.api_key);
    },
    get_bodyfat: async (params, creds) => {
      if (!params.gender || !params.age || !params.neck || !params.waist || !params.height) throw new Error('gender, age, neck, waist, height required');
      const qs = new URLSearchParams({ gender: params.gender, age: String(params.age), neck: String(params.neck), waist: String(params.waist), height: String(params.height), ...(params.hip && { hip: String(params.hip) }) }).toString();
      return ninjaGet(`/bodyfatpercentage?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
