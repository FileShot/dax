/**
 * Eight Sleep Smart Mattress API Integration
 */
'use strict';
const { TokenCache, makeRequest } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getToken(creds) {
  const key = `eightsleep:${creds.email}`;
  const cached = _cache.get(key);
  if (cached) return cached;
  const body = JSON.stringify({ email: creds.email, password: creds.password });
  const r = await makeRequest({ method: 'POST', hostname: 'client-api.8slp.net', path: '/v1/login', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body);
  if (!r.session || !r.session.token) throw new Error('Eight Sleep login failed');
  _cache.set(key, r.session.token, 3600);
  return r.session.token;
}

async function esReq(method, path, body, creds) {
  const token = await getToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'client-api.8slp.net', path, headers: { 'Session-Token': token, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'eight-sleep',
  name: 'Eight Sleep',
  category: 'health',
  icon: 'Moon',
  description: 'Control and monitor Eight Sleep smart mattresses — sleep data, temperature, and alarms.',
  configFields: [
    { key: 'email', label: 'Email Address', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.email || !creds.password) throw new Error('email and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds); return { success: true, message: 'Eight Sleep authenticated' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (params, creds) => esReq('GET', '/v1/users/me', null, creds),
    get_devices: async (params, creds) => esReq('GET', '/v1/users/me', null, creds).then(r => r.user?.devices || []),
    get_trends: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const qs = params.from ? `?from=${params.from}&to=${params.to || new Date().toISOString().split('T')[0]}` : '';
      return esReq('GET', `/v1/users/${params.user_id}/trends${qs}`, null, creds);
    },
    set_temperature: async (params, creds) => {
      if (!params.device_id || params.level === undefined) throw new Error('device_id and level required');
      const side = params.side || 'left';
      return esReq('PUT', `/v1/devices/${params.device_id}`, { [side + 'TargetHeatingLevel']: params.level }, creds);
    },
    get_intervals: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return esReq('GET', `/v1/users/${params.user_id}/intervals`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
