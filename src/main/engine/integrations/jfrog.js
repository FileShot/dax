/**
 * JFrog Artifactory API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function jfrogReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const auth = `Bearer ${creds.access_token}`;
  const opts = { method, hostname: host, path: `/artifactory/api${path}`, headers: { 'Authorization': auth, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'jfrog',
  name: 'JFrog Artifactory',
  category: 'developer',
  icon: 'Box',
  description: 'Manage JFrog Artifactory repositories, artifacts, and build info.',
  configFields: [
    { key: 'host', label: 'Artifactory URL (e.g. https://mycompany.jfrog.io)', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token (or API Key)', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.host || !creds.access_token) throw new Error('host and access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await jfrogReq('GET', '/system/ping', null, creds); if (typeof r === 'string' && r === 'OK') return { success: true, message: 'Connected to JFrog Artifactory' }; if (r.raw && r.raw.trim() === 'OK') return { success: true, message: 'Connected to JFrog Artifactory' }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_repositories: async (params, creds) => {
      const type = params.type ? `?type=${params.type}` : '';
      return jfrogReq('GET', `/repositories${type}`, null, creds);
    },
    get_repository: async (params, creds) => {
      if (!params.repo) throw new Error('repo key required');
      return jfrogReq('GET', `/repositories/${params.repo}`, null, creds);
    },
    search_artifacts: async (params, creds) => {
      if (!params.name) throw new Error('artifact name required');
      const qs = `?name=${encodeURIComponent(params.name)}${params.repos ? `&repos=${params.repos}` : ''}`;
      return jfrogReq('GET', `/search/artifact${qs}`, null, creds);
    },
    get_artifact_info: async (params, creds) => {
      if (!params.repo || !params.path) throw new Error('repo and path required');
      return jfrogReq('GET', `/storage/${params.repo}/${params.path}`, null, creds);
    },
    get_build_info: async (params, creds) => {
      if (!params.build_name) throw new Error('build_name required');
      const path = params.build_number ? `/build/${params.build_name}/${params.build_number}` : `/build/${params.build_name}`;
      return jfrogReq('GET', path, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
