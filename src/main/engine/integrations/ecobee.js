/**
 * Ecobee Thermostat API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ecobeeReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.ecobee.com', path, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json;charset=UTF-8', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'ecobee',
  name: 'Ecobee',
  category: 'smarthome',
  icon: 'Thermometer',
  description: 'Monitor and control Ecobee smart thermostats.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const sel = encodeURIComponent(JSON.stringify({ includeRuntime: false, includeSettings: false }));
      const r = await ecobeeReq('GET', `/1/thermostat?format=json&body=${encodeURIComponent(JSON.stringify({ selection: { selectionType: 'registered', selectionMatch: '', includeRuntime: false } }))}`, null, creds);
      return { success: true, message: `Found ${(r.thermostatList || []).length} thermostat(s)` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_thermostat: async (params, creds) => {
      const selection = { selectionType: params.selection_type || 'registered', selectionMatch: params.thermostat_id || '', includeSettings: true, includeRuntime: true, includeAlerts: true };
      const body = encodeURIComponent(JSON.stringify({ selection }));
      return ecobeeReq('GET', `/1/thermostat?format=json&body=${body}`, null, creds);
    },
    get_thermostat_summary: async (params, creds) => {
      const selection = { selectionType: 'registered', selectionMatch: '', includeEquipmentStatus: true };
      const body = encodeURIComponent(JSON.stringify({ selection }));
      return ecobeeReq('GET', `/1/thermostatSummary?format=json&body=${body}`, null, creds);
    },
    set_hold: async (params, creds) => {
      if (!params.thermostat_id) throw new Error('thermostat_id required');
      const body = { selection: { selectionType: 'thermostats', selectionMatch: params.thermostat_id }, functions: [{ type: 'setHold', params: { holdType: params.hold_type || 'nextTransition', heatHoldTemp: params.heat_hold_temp, coolHoldTemp: params.cool_hold_temp } }] };
      return ecobeeReq('POST', '/1/thermostat?format=json', body, creds);
    },
    resume_program: async (params, creds) => {
      if (!params.thermostat_id) throw new Error('thermostat_id required');
      const body = { selection: { selectionType: 'thermostats', selectionMatch: params.thermostat_id }, functions: [{ type: 'resumeProgram', params: { resumeAll: params.resume_all || false } }] };
      return ecobeeReq('POST', '/1/thermostat?format=json', body, creds);
    },
    send_message: async (params, creds) => {
      if (!params.thermostat_id || !params.text) throw new Error('thermostat_id and text required');
      const body = { selection: { selectionType: 'thermostats', selectionMatch: params.thermostat_id }, functions: [{ type: 'sendMessage', params: { text: params.text } }] };
      return ecobeeReq('POST', '/1/thermostat?format=json', body, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
