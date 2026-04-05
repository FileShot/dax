/**
 * OpenFDA Drug & Food Safety API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function fdaGet(path, apiKey) {
  const sep = path.includes('?') ? '&' : '?';
  const keyParam = apiKey ? `${sep}api_key=${apiKey}` : '';
  const opts = { method: 'GET', hostname: 'api.fda.gov', path: `${path}${keyParam}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'fda-opendata',
  name: 'OpenFDA',
  category: 'government',
  icon: 'FlaskConical',
  description: 'Access FDA drug labels, adverse events, recalls, and device data via openFDA.',
  configFields: [{ key: 'api_key', label: 'API Key (optional — improves rate limits)', type: 'password', required: false }],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fdaGet('/drug/label.json?limit=1', creds.api_key); if (r.error) return { success: false, message: r.error.message }; return { success: true, message: 'Connected to OpenFDA' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    drug_search: async (params, creds) => {
      if (!params.query) throw new Error('query required (e.g. "openfda.brand_name:tylenol")');
      return fdaGet(`/drug/label.json?search=${encodeURIComponent(params.query)}&limit=${params.limit || 10}`, creds.api_key);
    },
    device_recall: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.query && { search: params.query }), limit: String(params.limit || 10), ...(params.skip && { skip: String(params.skip) }) }).toString();
      return fdaGet(`/device/recall.json?${qs}`, creds.api_key);
    },
    food_enforcement: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.query && { search: params.query }), limit: String(params.limit || 10) }).toString();
      return fdaGet(`/food/enforcement.json?${qs}`, creds.api_key);
    },
    drug_event: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.query && { search: params.query }), limit: String(params.limit || 10) }).toString();
      return fdaGet(`/drug/event.json?${qs}`, creds.api_key);
    },
    label_search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return fdaGet(`/drug/label.json?search=${encodeURIComponent(params.query)}&limit=${params.limit || 10}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
