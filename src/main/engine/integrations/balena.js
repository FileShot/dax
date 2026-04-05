/**
 * balena Cloud Fleet Management Integration
 */
'use strict';
const https = require('https');

function balenaReq(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'api.balena-cloud.com', path: `/v6${path}`,
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
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
  id: 'balena',
  name: 'balena Cloud',
  category: 'iot',
  icon: 'Cloud',
  description: 'Manage balena cloud fleets, devices, and deployments for IoT at scale.',
  configFields: [
    { key: 'api_key', label: 'API Key (Auth Token)', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await balenaReq('GET', '/whoami', creds.api_key); if (r.code === 'Unauthorized') return { success: false, message: 'Invalid API key' }; return { success: true, message: `Connected as ${r.username || r.email || 'balena user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_fleets: async (params, creds) => {
      const qs = new URLSearchParams({ $top: String(params.$top || 20), ...(params.$filter && { $filter: params.$filter }) }).toString();
      return balenaReq('GET', `/application?${qs}`, creds.api_key);
    },
    get_fleet: async (params, creds) => {
      if (!params.fleet_id) throw new Error('fleet_id required');
      return balenaReq('GET', `/application(${params.fleet_id})`, creds.api_key);
    },
    list_devices: async (params, creds) => {
      const qs = new URLSearchParams({ $top: String(params.$top || 20), ...(params.fleet_id && { $filter: `belongs_to__application eq ${params.fleet_id}` }) }).toString();
      return balenaReq('GET', `/device?${qs}`, creds.api_key);
    },
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return balenaReq('GET', `/device(${params.device_id})`, creds.api_key);
    },
    restart_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      return balenaReq('POST', `/device(${params.device_id})/restart`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
