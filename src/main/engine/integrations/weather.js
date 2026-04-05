/**
 * Weather API Integration (OpenWeatherMap)
 */
'use strict';
const https = require('https');

function weatherApi(path, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `https://api.openweathermap.org${path}&appid=${apiKey}`;
    const parsed = new URL(url);
    const req = https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
  });
}

module.exports = {
  id: 'weather',
  name: 'Weather',
  category: 'data',
  icon: 'CloudSun',
  description: 'Get current weather, forecasts, and air quality data.',
  configFields: [
    { key: 'api_key', label: 'OpenWeatherMap API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await weatherApi('/data/2.5/weather?q=London&units=metric', creds.api_key); return { success: r.cod === 200, message: r.cod === 200 ? 'API key valid' : `Error: ${r.message}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    current: async (params, creds) => {
      if (!params.city && !(params.lat && params.lon)) throw new Error('city or lat/lon required');
      const q = params.city ? `q=${encodeURIComponent(params.city)}` : `lat=${params.lat}&lon=${params.lon}`;
      const units = params.units || 'metric';
      const r = await weatherApi(`/data/2.5/weather?${q}&units=${units}`, creds.api_key);
      if (r.cod !== 200) throw new Error(r.message);
      return { city: r.name, country: r.sys?.country, temp: r.main?.temp, feels_like: r.main?.feels_like, humidity: r.main?.humidity, pressure: r.main?.pressure, wind_speed: r.wind?.speed, wind_deg: r.wind?.deg, description: r.weather?.[0]?.description, icon: r.weather?.[0]?.icon, visibility: r.visibility, clouds: r.clouds?.all };
    },
    forecast: async (params, creds) => {
      if (!params.city && !(params.lat && params.lon)) throw new Error('city or lat/lon required');
      const q = params.city ? `q=${encodeURIComponent(params.city)}` : `lat=${params.lat}&lon=${params.lon}`;
      const units = params.units || 'metric';
      const r = await weatherApi(`/data/2.5/forecast?${q}&units=${units}&cnt=${params.count || 8}`, creds.api_key);
      return { city: r.city?.name, country: r.city?.country, forecasts: (r.list || []).map((f) => ({ dt: f.dt_txt, temp: f.main?.temp, feels_like: f.main?.feels_like, humidity: f.main?.humidity, description: f.weather?.[0]?.description, wind_speed: f.wind?.speed, pop: f.pop })) };
    },
    air_quality: async (params, creds) => {
      if (!(params.lat && params.lon)) throw new Error('lat and lon required');
      const r = await weatherApi(`/data/2.5/air_pollution?lat=${params.lat}&lon=${params.lon}`, creds.api_key);
      const data = r.list?.[0];
      return { aqi: data?.main?.aqi, components: data?.components };
    },
    geocode: async (params, creds) => {
      if (!params.city) throw new Error('city required');
      return weatherApi(`/geo/1.0/direct?q=${encodeURIComponent(params.city)}&limit=${params.limit || 5}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
