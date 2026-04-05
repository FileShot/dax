/**
 * Fly.io Machines API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function flyReq(method, path, body, token) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.machines.dev', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'fly-io',
  name: 'Fly.io',
  category: 'developer',
  icon: 'Server',
  description: 'Deploy and manage Fly.io apps and Machines (VMs) via the Fly Machines API.',
  configFields: [{ key: 'api_key', label: 'Fly.io API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await flyReq('GET', '/apps', null, creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to Fly.io' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_app: async (params, creds) => {
      if (!params.app_name || !params.org_slug) throw new Error('app_name and org_slug required');
      return flyReq('POST', '/apps', { app_name: params.app_name, org_slug: params.org_slug }, creds.api_key);
    },
    list_machines: async (params, creds) => {
      if (!params.app_name) throw new Error('app_name required');
      return flyReq('GET', `/apps/${params.app_name}/machines`, null, creds.api_key);
    },
    create_machine: async (params, creds) => {
      if (!params.app_name || !params.config) throw new Error('app_name and config required');
      return flyReq('POST', `/apps/${params.app_name}/machines`, { config: params.config, ...(params.name && { name: params.name }), ...(params.region && { region: params.region }) }, creds.api_key);
    },
    start_machine: async (params, creds) => {
      if (!params.app_name || !params.machine_id) throw new Error('app_name and machine_id required');
      return flyReq('POST', `/apps/${params.app_name}/machines/${params.machine_id}/start`, null, creds.api_key);
    },
    get_machine: async (params, creds) => {
      if (!params.app_name || !params.machine_id) throw new Error('app_name and machine_id required');
      return flyReq('GET', `/apps/${params.app_name}/machines/${params.machine_id}`, null, creds.api_key);
    },
    stop_machine: async (params, creds) => {
      if (!params.app_name || !params.machine_id) throw new Error('app_name and machine_id required');
      return flyReq('POST', `/apps/${params.app_name}/machines/${params.machine_id}/stop`, null, creds.api_key);
    },
    delete_machine: async (params, creds) => {
      if (!params.app_name || !params.machine_id) throw new Error('app_name and machine_id required');
      return flyReq('DELETE', `/apps/${params.app_name}/machines/${params.machine_id}`, null, creds.api_key);
    },
    list_apps: async (params, creds) => {
      if (!params.org_slug) throw new Error('org_slug required');
      return flyReq('GET', `/apps?org_slug=${params.org_slug}`, null, creds.api_key);
    },
    delete_app: async (params, creds) => {
      if (!params.app_name) throw new Error('app_name required');
      return flyReq('DELETE', `/apps/${params.app_name}`, null, creds.api_key);
    },
    list_volumes: async (params, creds) => {
      if (!params.app_name) throw new Error('app_name required');
      return flyReq('GET', `/apps/${params.app_name}/volumes`, null, creds.api_key);
    },
    create_volume: async (params, creds) => {
      if (!params.app_name || !params.name || !params.size_gb) throw new Error('app_name, name, and size_gb required');
      return flyReq('POST', `/apps/${params.app_name}/volumes`, { name: params.name, size_gb: params.size_gb, ...(params.region && { region: params.region }) }, creds.api_key);
    },
    wait_machine: async (params, creds) => {
      if (!params.app_name || !params.machine_id) throw new Error('app_name and machine_id required');
      const state = params.state || 'started';
      const timeout = params.timeout || 30;
      return flyReq('GET', `/apps/${params.app_name}/machines/${params.machine_id}/wait?state=${state}&timeout=${timeout}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
