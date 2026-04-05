/**
 * OpenSea NFT Marketplace API Integration
 */
'use strict';
const https = require('https');

function openSeaRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.opensea.io', path: `/api/v2${path}`, headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'opensea',
  name: 'OpenSea',
  category: 'blockchain',
  icon: 'Gem',
  description: 'Query NFT collections, listings, and offers on the OpenSea marketplace.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await openSeaRequest('GET', '/collections?limit=1', null, creds.api_key); return { success: Array.isArray(r.collections), message: r.detail || 'Connected to OpenSea' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_collection: async (params, creds) => {
      if (!params.collection_slug) throw new Error('collection_slug required');
      return openSeaRequest('GET', `/collections/${params.collection_slug}`, null, creds.api_key);
    },
    list_nfts_by_collection: async (params, creds) => {
      if (!params.collection_slug) throw new Error('collection_slug required');
      const qs = `?limit=${params.limit || 20}${params.next ? `&next=${params.next}` : ''}`;
      return openSeaRequest('GET', `/collection/${params.collection_slug}/nfts${qs}`, null, creds.api_key);
    },
    get_nft: async (params, creds) => {
      if (!params.chain || !params.address || !params.identifier) throw new Error('chain, address, and identifier required');
      return openSeaRequest('GET', `/chain/${params.chain}/contract/${params.address}/nfts/${params.identifier}`, null, creds.api_key);
    },
    list_listings: async (params, creds) => {
      if (!params.collection_slug) throw new Error('collection_slug required');
      const qs = `?limit=${params.limit || 20}`;
      return openSeaRequest('GET', `/listings/collection/${params.collection_slug}/all${qs}`, null, creds.api_key);
    },
    get_account: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return openSeaRequest('GET', `/accounts/${params.address}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
