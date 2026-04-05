/**
 * SmartThings API Integration
 */
'use strict';
const https = require('https');

function stApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.smartthings.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'smartthings',
  name: 'SmartThings',
  category: 'iot',
  icon: 'Smartphone',
  description: 'Control smart home devices via Samsung SmartThings.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await stApi('GET', '/locations', creds.access_token); return { success: !!r.items, message: r.items ? `${r.items.length} location(s) found` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (params, creds) => stApi('GET', '/devices', creds.access_token),
    get_device_status: async (params, creds) => { if (!params.device_id) throw new Error('device_id required'); return stApi('GET', `/devices/${params.device_id}/status`, creds.access_token); },
    execute_command: async (params, creds) => {
      if (!params.device_id || !params.capability || !params.command) throw new Error('device_id, capability, and command required');
      return stApi('POST', `/devices/${params.device_id}/commands`, creds.access_token, { commands: [{ component: params.component || 'main', capability: params.capability, command: params.command, arguments: params.arguments || [] }] });
    },
    list_locations: async (params, creds) => stApi('GET', '/locations', creds.access_token),
    list_rooms: async (params, creds) => { if (!params.location_id) throw new Error('location_id required'); return stApi('GET', `/locations/${params.location_id}/rooms`, creds.access_token); },
    list_scenes: async (params, creds) => stApi('GET', '/scenes', creds.access_token),
    execute_scene: async (params, creds) => { if (!params.scene_id) throw new Error('scene_id required'); return stApi('POST', `/scenes/${params.scene_id}/execute`, creds.access_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
