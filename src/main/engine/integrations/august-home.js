/**
 * August Home Smart Lock API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function augustReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api-production.august.com', path, headers: { 'x-august-api-key': 'tempkey01', 'x-kease-api-key': 'tempkey01', 'Content-Type': 'application/json', 'Accept-Version': '0.0.1', 'User-Agent': 'August/Luna-3.2-3.4.201 iOS/14', 'Authorization': `Bearer ${creds.access_token}`, ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'august-home',
  name: 'August Home',
  category: 'smarthome',
  icon: 'Lock',
  description: 'Control August smart locks — lock, unlock, and check status.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await augustReq('GET', '/users/locks/mine', null, creds); return { success: true, message: `Found ${Object.keys(r || {}).length} lock(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_locks: async (params, creds) => {
      return augustReq('GET', '/users/locks/mine', null, creds);
    },
    get_lock: async (params, creds) => {
      if (!params.lock_id) throw new Error('lock_id required');
      return augustReq('GET', `/locks/${params.lock_id}`, null, creds);
    },
    get_lock_status: async (params, creds) => {
      if (!params.lock_id) throw new Error('lock_id required');
      return augustReq('GET', `/locks/${params.lock_id}/status`, null, creds);
    },
    lock: async (params, creds) => {
      if (!params.lock_id) throw new Error('lock_id required');
      return augustReq('PUT', `/remoteoperate/${params.lock_id}/lock`, null, creds);
    },
    unlock: async (params, creds) => {
      if (!params.lock_id) throw new Error('lock_id required');
      return augustReq('PUT', `/remoteoperate/${params.lock_id}/unlock`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
