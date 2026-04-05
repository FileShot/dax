/**
 * Philips Hue Bridge API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function hueApi(method, bridgeIp, path, username, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: bridgeIp, path: `/api/${username}${path}`, headers: { 'Content-Type': 'application/json' }, rejectUnauthorized: false };
    const req = http.request(opts, (res) => {
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
  id: 'philips-hue',
  name: 'Philips Hue',
  category: 'iot',
  icon: 'Lightbulb',
  description: 'Control Philips Hue smart lights via the Bridge API.',
  configFields: [
    { key: 'bridge_ip', label: 'Bridge IP Address', type: 'text', required: true },
    { key: 'username', label: 'API Username/Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.bridge_ip || !creds.username) throw new Error('Bridge IP and username required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hueApi('GET', creds.bridge_ip, '/config', creds.username); return { success: !!r.name, message: r.name ? `Connected to ${r.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_lights: async (params, creds) => hueApi('GET', creds.bridge_ip, '/lights', creds.username),
    get_light: async (params, creds) => { if (!params.light_id) throw new Error('light_id required'); return hueApi('GET', creds.bridge_ip, `/lights/${params.light_id}`, creds.username); },
    set_light_state: async (params, creds) => {
      if (!params.light_id) throw new Error('light_id required');
      const state = {};
      if (params.on !== undefined) state.on = params.on;
      if (params.brightness !== undefined) state.bri = Math.max(0, Math.min(254, params.brightness));
      if (params.hue !== undefined) state.hue = params.hue;
      if (params.saturation !== undefined) state.sat = params.saturation;
      if (params.color_temp !== undefined) state.ct = params.color_temp;
      return hueApi('PUT', creds.bridge_ip, `/lights/${params.light_id}/state`, creds.username, state);
    },
    list_groups: async (params, creds) => hueApi('GET', creds.bridge_ip, '/groups', creds.username),
    set_group_action: async (params, creds) => {
      if (!params.group_id) throw new Error('group_id required');
      const action = {};
      if (params.on !== undefined) action.on = params.on;
      if (params.brightness !== undefined) action.bri = params.brightness;
      if (params.scene !== undefined) action.scene = params.scene;
      return hueApi('PUT', creds.bridge_ip, `/groups/${params.group_id}/action`, creds.username, action);
    },
    list_scenes: async (params, creds) => hueApi('GET', creds.bridge_ip, '/scenes', creds.username),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
