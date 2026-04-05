/**
 * GovInfo US Government Publishing Office Integration (free, no auth)
 */
'use strict';
const https = require('https');

function govGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'api.govinfo.gov', path: `${path}${sep}api_key=${apiKey}`, headers: { 'Accept': 'application/json' } };
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
  id: 'govinfo',
  name: 'GovInfo (US GPO)',
  category: 'legal',
  icon: 'Landmark',
  description: 'Access US Federal Government publications — bills, codes, regulations, and court opinions.',
  configFields: [{ key: 'api_key', label: 'API Key (get free key at api.data.gov)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required (free at api.data.gov)'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await govGet('/packages/BILLS-118hr1eas/summary', creds.api_key); if (r.error) return { success: false, message: r.error.message || r.error }; return { success: true, message: 'Connected to GovInfo API' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, pageSize: String(params.pageSize || 20), offsetMark: params.offsetMark || '*', ...(params.collections && { collections: params.collections }), ...(params.dateIssuedStartDate && { dateIssuedStartDate: params.dateIssuedStartDate }) }).toString();
      return govGet(`/search?${qs}`, creds.api_key);
    },
    get_package_summary: async (params, creds) => {
      if (!params.package_id) throw new Error('package_id required (e.g. BILLS-118hr1eas)');
      return govGet(`/packages/${params.package_id}/summary`, creds.api_key);
    },
    get_package_granules: async (params, creds) => {
      if (!params.package_id) throw new Error('package_id required');
      const qs = new URLSearchParams({ pageSize: String(params.pageSize || 20) }).toString();
      return govGet(`/packages/${params.package_id}/granules?${qs}`, creds.api_key);
    },
    list_collections: async (_p, creds) => {
      return govGet('/collections', creds.api_key);
    },
    get_collection: async (params, creds) => {
      if (!params.collection) throw new Error('collection required (e.g. BILLS, CFR, USCODE)');
      const qs = new URLSearchParams({ pageSize: String(params.pageSize || 20), ...(params.startDate && { startDate: params.startDate }), ...(params.endDate && { endDate: params.endDate }) }).toString();
      return govGet(`/collections/${params.collection}/${params.startDate || '2024-01-01T00:00:00Z'}?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
