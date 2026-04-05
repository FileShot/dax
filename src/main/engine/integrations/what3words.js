/**
 * What3Words API Integration
 */
'use strict';
const https = require('https');

function w3wRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.what3words.com', path: `${path}${separator}key=${encodeURIComponent(apiKey)}` };
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
  id: 'what3words',
  name: 'What3Words',
  category: 'maps',
  icon: 'Grid3x3',
  description: 'Convert between coordinates and What3Words three-word addresses.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await w3wRequest('/v3/convert-to-3wa?coordinates=51.521251%2C-0.203586', creds.api_key); return { success: !!r.words, message: r.error?.message || 'Connected to What3Words' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    to_address: async (params, creds) => {
      if (!params.lat || !params.lng) throw new Error('lat and lng required');
      const qs = `coordinates=${params.lat},${params.lng}${params.language ? `&language=${params.language}` : ''}`;
      return w3wRequest(`/v3/convert-to-3wa?${qs}`, creds.api_key);
    },
    to_coordinates: async (params, creds) => {
      if (!params.words) throw new Error('words required (e.g. "index.home.raft")');
      return w3wRequest(`/v3/convert-to-coordinates?words=${encodeURIComponent(params.words)}`, creds.api_key);
    },
    autosuggest: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      const qs = new URLSearchParams({ input: params.input, ...(params.focus && { focus: params.focus }), ...(params.clip_to_country && { 'clip-to-country': params.clip_to_country }), ...(params.language && { language: params.language }), ...(params.n_results && { 'n-results': String(params.n_results) }) }).toString();
      return w3wRequest(`/v3/autosuggest?${qs}`, creds.api_key);
    },
    grid_section: async (params, creds) => {
      if (!params.bounding_box) throw new Error('bounding_box required (e.g. "51.1,0.1,51.2,0.2")');
      return w3wRequest(`/v3/grid-section?bounding-box=${encodeURIComponent(params.bounding_box)}`, creds.api_key);
    },
    available_languages: async (params, creds) => {
      return w3wRequest('/v3/available-languages', creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
