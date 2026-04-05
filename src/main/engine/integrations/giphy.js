/**
 * Giphy API Integration
 */
'use strict';
const https = require('https');

function giphyApi(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.giphy.com', path: `/v1${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'giphy',
  name: 'Giphy',
  category: 'design',
  icon: 'Film',
  description: 'Search and access GIFs from Giphy.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await giphyApi('/gifs/trending?limit=1', creds.api_key); return { success: r.meta?.status === 200, message: r.meta?.status === 200 ? 'Connected to Giphy' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return giphyApi(`/gifs/search?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}&offset=${params.offset || 0}&rating=${params.rating || 'g'}`, creds.api_key);
    },
    trending: async (params, creds) => giphyApi(`/gifs/trending?limit=${params.limit || 10}&rating=${params.rating || 'g'}`, creds.api_key),
    get_gif: async (params, creds) => { if (!params.gif_id) throw new Error('gif_id required'); return giphyApi(`/gifs/${params.gif_id}`, creds.api_key); },
    random: async (params, creds) => {
      const tag = params.tag ? `?tag=${encodeURIComponent(params.tag)}` : '?';
      return giphyApi(`/gifs/random${tag}&rating=${params.rating || 'g'}`, creds.api_key);
    },
    search_stickers: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return giphyApi(`/stickers/search?q=${encodeURIComponent(params.query)}&limit=${params.limit || 10}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
