/**
 * LIFX HTTP API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function lifxReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.lifx.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'lifx',
  name: 'LIFX',
  category: 'smarthome',
  icon: 'Lightbulb',
  description: 'Control LIFX smart bulbs — set color, brightness, and effects.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await lifxReq('GET', '/v1/lights/all', null, creds); return { success: true, message: `Found ${(r || []).length} light(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_lights: async (params, creds) => {
      const selector = params.selector || 'all';
      return lifxReq('GET', `/v1/lights/${selector}`, null, creds);
    },
    set_state: async (params, creds) => {
      const selector = params.selector || 'all';
      const { selector: _s, ...state } = params;
      return lifxReq('PUT', `/v1/lights/${selector}/state`, state, creds);
    },
    toggle_power: async (params, creds) => {
      const selector = params.selector || 'all';
      return lifxReq('POST', `/v1/lights/${selector}/toggle`, {}, creds);
    },
    breathe_effect: async (params, creds) => {
      if (!params.color) throw new Error('color required');
      const selector = params.selector || 'all';
      return lifxReq('POST', `/v1/lights/${selector}/effects/breathe`, params, creds);
    },
    pulse_effect: async (params, creds) => {
      if (!params.color) throw new Error('color required');
      const selector = params.selector || 'all';
      return lifxReq('POST', `/v1/lights/${selector}/effects/pulse`, params, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
