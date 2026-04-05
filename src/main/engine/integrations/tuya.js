/**
 * Tuya IoT Platform Integration
 */
'use strict';
const crypto = require('crypto');
const { TokenCache, makeRequest } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getToken(creds) {
  const key = `tuya:${creds.access_key}`;
  const cached = _cache.get(key);
  if (cached) return cached;
  const t = Date.now().toString();
  const str = `${creds.access_key}${t}`;
  const sign = crypto.createHmac('sha256', creds.secret_key).update(str).digest('hex').toUpperCase();
  const r = await makeRequest({ method: 'GET', hostname: creds.endpoint || 'openapi.tuyaus.com', path: '/v1.0/token?grant_type=1', headers: { 'client_id': creds.access_key, 't': t, 'sign': sign, 'sign_method': 'HMAC-SHA256', 'Content-Type': 'application/json' } }, null);
  if (!r.result || !r.result.access_token) throw new Error('Tuya token error: ' + JSON.stringify(r));
  _cache.set(key, r.result.access_token, r.result.expire_time || 7200);
  return r.result.access_token;
}

async function tuyaReq(method, path, body, creds) {
  const token = await getToken(creds);
  const t = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
  const str = `${creds.access_key}${token}${t}\n${method.toUpperCase()}\n${contentHash}\n\n${path}`;
  const sign = crypto.createHmac('sha256', creds.secret_key).update(str).digest('hex').toUpperCase();
  const opts = { method, hostname: creds.endpoint || 'openapi.tuyaus.com', path, headers: { 'client_id': creds.access_key, 'access_token': token, 't': t, 'sign': sign, 'sign_method': 'HMAC-SHA256', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr || null);
}

module.exports = {
  id: 'tuya',
  name: 'Tuya IoT',
  category: 'smarthome',
  icon: 'Wifi',
  description: 'Control and monitor smart home devices via the Tuya IoT Platform.',
  configFields: [
    { key: 'access_key', label: 'Access Key (Client ID)', type: 'text', required: true },
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
    { key: 'endpoint', label: 'Endpoint (default: openapi.tuyaus.com)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_key || !creds.secret_key) throw new Error('access_key and secret_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds); return { success: true, message: 'Tuya token obtained successfully' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (params, creds) => {
      const qs = `?page_size=${params.page_size || 20}&page_no=${params.page_no || 1}`;
      return tuyaReq('GET', `/v1.0/iot-03/devices${qs}`, null, creds);
    },
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return tuyaReq('GET', `/v1.0/iot-03/devices/${params.device_id}`, null, creds);
    },
    control_device: async (params, creds) => {
      if (!params.device_id || !params.commands) throw new Error('device_id and commands required');
      return tuyaReq('POST', `/v1.0/iot-03/devices/${params.device_id}/commands`, { commands: params.commands }, creds);
    },
    get_device_status: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return tuyaReq('GET', `/v1.0/iot-03/devices/${params.device_id}/status`, null, creds);
    },
    get_device_log: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      const qs = `?start_row_key=${params.start_row_key || ''}&size=${params.size || 20}`;
      return tuyaReq('GET', `/v1.0/iot-03/devices/${params.device_id}/logs${qs}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
