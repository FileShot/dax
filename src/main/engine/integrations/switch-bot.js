/**
 * SwitchBot API Integration
 */
'use strict';
const crypto = require('crypto');
const { makeRequest } = require('../../engine/integration-utils');

function getHeaders(creds) {
  const t = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');
  const data = `${creds.token}${t}${nonce}`;
  const sign = crypto.createHmac('sha256', creds.secret).update(Buffer.from(data, 'utf-8')).digest('base64');
  return { 'Authorization': creds.token, 't': t, 'sign': sign, 'nonce': nonce, 'Content-Type': 'application/json' };
}

function sbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const headers = getHeaders(creds);
  const opts = { method, hostname: 'api.switch-bot.com', path, headers: { ...headers, ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'switch-bot',
  name: 'SwitchBot',
  category: 'smarthome',
  icon: 'ToggleRight',
  description: 'Control SwitchBot smart home devices and run scenes.',
  configFields: [
    { key: 'token', label: 'Open Token', type: 'password', required: true },
    { key: 'secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.token || !creds.secret) throw new Error('token and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sbReq('GET', '/v1.1/devices', null, creds); return { success: true, message: `Found ${((r.body || {}).deviceList || []).length} device(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (params, creds) => {
      return sbReq('GET', '/v1.1/devices', null, creds);
    },
    get_device_status: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return sbReq('GET', `/v1.1/devices/${params.device_id}/status`, null, creds);
    },
    control_device: async (params, creds) => {
      if (!params.device_id || !params.command) throw new Error('device_id and command required');
      return sbReq('POST', `/v1.1/devices/${params.device_id}/commands`, { command: params.command, parameter: params.parameter || 'default', commandType: params.command_type || 'command' }, creds);
    },
    get_scenes: async (params, creds) => {
      return sbReq('GET', '/v1.1/scenes', null, creds);
    },
    execute_scene: async (params, creds) => {
      if (!params.scene_id) throw new Error('scene_id required');
      return sbReq('POST', `/v1.1/scenes/${params.scene_id}/execute`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
