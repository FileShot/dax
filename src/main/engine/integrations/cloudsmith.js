/**
 * Cloudsmith Package Registry API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function csReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.cloudsmith.io', path, headers: { 'Authorization': `token ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'cloudsmith',
  name: 'Cloudsmith',
  category: 'developer',
  icon: 'Package',
  description: 'Manage packages and repositories on the Cloudsmith package registry.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'org', label: 'Organisation Slug', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.org) throw new Error('api_key and org required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await csReq('GET', '/v1/user/', null, creds); return { success: true, message: `Connected as ${r.slug || r.email || 'user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_repositories: async (params, creds) => {
      const qs = params.page ? `?page=${params.page}` : '';
      return csReq('GET', `/v1/repos/${creds.org}/${qs}`, null, creds);
    },
    get_repository: async (params, creds) => {
      if (!params.repo) throw new Error('repo slug required');
      return csReq('GET', `/v1/repos/${creds.org}/${params.repo}/`, null, creds);
    },
    list_packages: async (params, creds) => {
      if (!params.repo) throw new Error('repo slug required');
      const qs = params.query ? `?query=${encodeURIComponent(params.query)}` : '';
      return csReq('GET', `/v1/packages/${creds.org}/${params.repo}/${qs}`, null, creds);
    },
    get_package: async (params, creds) => {
      if (!params.repo || !params.identifier) throw new Error('repo and identifier required');
      return csReq('GET', `/v1/packages/${creds.org}/${params.repo}/${params.identifier}/`, null, creds);
    },
    list_namespaces: async (_params, creds) => {
      return csReq('GET', '/v1/namespaces/', null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
