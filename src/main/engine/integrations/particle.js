/**
 * Particle Cloud IoT Integration
 */
'use strict';
const https = require('https');

function particleReq(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? new URLSearchParams(body).toString() : undefined;
    const opts = {
      method, hostname: 'api.particle.io', path: `/v1${path}`,
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'particle',
  name: 'Particle Cloud',
  category: 'iot',
  icon: 'Cpu',
  description: 'Manage Particle IoT devices, call functions, read variables, and publish events.',
  configFields: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await particleReq('GET', '/user', creds.access_token); if (r.error) return { success: false, message: r.error_description || r.error }; return { success: true, message: `Connected as ${r.username || 'Particle user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (_params, creds) => particleReq('GET', '/devices', creds.access_token),
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return particleReq('GET', `/devices/${params.device_id}`, creds.access_token);
    },
    call_function: async (params, creds) => {
      if (!params.device_id || !params.function_name) throw new Error('device_id and function_name required');
      return particleReq('POST', `/devices/${params.device_id}/${params.function_name}`, creds.access_token, { arg: params.arg || '' });
    },
    get_variable: async (params, creds) => {
      if (!params.device_id || !params.variable_name) throw new Error('device_id and variable_name required');
      return particleReq('GET', `/devices/${params.device_id}/${params.variable_name}`, creds.access_token);
    },
    publish_event: async (params, creds) => {
      if (!params.name) throw new Error('event name required');
      return particleReq('POST', '/events', creds.access_token, { name: params.name, data: params.data || '', private: params.private ? 'true' : 'false', ttl: String(params.ttl || 60) });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
