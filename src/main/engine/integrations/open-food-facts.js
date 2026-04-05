/**
 * Open Food Facts Integration (free, no auth)
 */
'use strict';
const https = require('https');

function offGet(path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'world.openfoodfacts.org', path, headers: { 'Accept': 'application/json', 'User-Agent': 'DaxAgent/1.0' } };
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
  id: 'open-food-facts',
  name: 'Open Food Facts',
  category: 'food',
  icon: 'ShoppingBasket',
  description: 'Access crowdsourced food product data, barcodes, and nutritional information.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await offGet('/api/v2/product/737628064502.json'); if (r.status === 0) return { success: false, message: 'Product not found' }; return { success: true, message: 'Connected to Open Food Facts' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_product_by_barcode: async (params, _creds) => {
      if (!params.barcode) throw new Error('barcode required');
      return offGet(`/api/v2/product/${params.barcode}.json`);
    },
    search_products: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ search_terms: params.query, page_size: String(params.page_size || 20), page: String(params.page || 1), json: '1' }).toString();
      return offGet(`/cgi/search.pl?${qs}`);
    },
    get_by_category: async (params, _creds) => {
      if (!params.category) throw new Error('category required');
      return offGet(`/category/${encodeURIComponent(params.category)}.json`);
    },
    get_additives: async (params, _creds) => {
      return offGet(`/additives.json`);
    },
    get_ingredients: async (params, _creds) => {
      if (!params.ingredient) throw new Error('ingredient required');
      return offGet(`/ingredient/${encodeURIComponent(params.ingredient)}.json`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
