/**
 * npm Registry API Integration (free, no auth for public queries)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function npmGet(path) {
  const opts = { method: 'GET', hostname: 'registry.npmjs.org', path, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

function npmSearchGet(qs) {
  const opts = { method: 'GET', hostname: 'registry.npmjs.org', path: `/-/v1/search?${qs}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'npmjs',
  name: 'npm Registry',
  category: 'developer',
  icon: 'Package',
  description: 'Search npm packages, get package metadata, versions, and download stats.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await npmGet('/lodash/latest'); if (r.name) return { success: true, message: 'Connected to npm Registry' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_packages: async (params, _creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ text: params.query, size: String(params.size || 20), from: String(params.from || 0), ...(params.quality && { quality: String(params.quality) }), ...(params.popularity && { popularity: String(params.popularity) }) }).toString();
      return npmSearchGet(qs);
    },
    get_package: async (params, _creds) => {
      if (!params.name) throw new Error('package name required');
      return npmGet(`/${encodeURIComponent(params.name)}`);
    },
    get_latest: async (params, _creds) => {
      if (!params.name) throw new Error('package name required');
      return npmGet(`/${encodeURIComponent(params.name)}/latest`);
    },
    get_version: async (params, _creds) => {
      if (!params.name || !params.version) throw new Error('package name and version required');
      return npmGet(`/${encodeURIComponent(params.name)}/${params.version}`);
    },
    get_downloads: async (params, _creds) => {
      if (!params.name) throw new Error('package name required');
      const period = params.period || 'last-week';
      const opts = { method: 'GET', hostname: 'api.npmjs.org', path: `/downloads/point/${period}/${encodeURIComponent(params.name)}`, headers: { 'Accept': 'application/json' } };
      return makeRequest(opts, null);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
