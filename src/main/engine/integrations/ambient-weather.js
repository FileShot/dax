/**
 * Ambient Weather API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function awReq(path, creds) {
  const sep = path.includes('?') ? '&' : '?';
  const opts = { method: 'GET', hostname: 'api.ambientweather.net', path: `${path}${sep}apiKey=${creds.api_key}&applicationKey=${creds.application_key}`, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'ambient-weather',
  name: 'Ambient Weather',
  category: 'smarthome',
  icon: 'CloudRain',
  description: 'Access personal weather station data from the Ambient Weather Network.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'application_key', label: 'Application Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.application_key) throw new Error('api_key and application_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await awReq('/v1/devices', creds); return { success: true, message: `Found ${(r || []).length} device(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_devices: async (params, creds) => {
      return awReq('/v1/devices', creds);
    },
    get_device_data: async (params, creds) => {
      if (!params.mac_address) throw new Error('mac_address required');
      const qs = params.limit ? `?limit=${params.limit}` : '';
      return awReq(`/v1/devices/${params.mac_address}${qs}`, creds);
    },
    get_latest: async (params, creds) => {
      if (!params.mac_address) throw new Error('mac_address required');
      return awReq(`/v1/devices/${params.mac_address}?limit=1`, creds);
    },
    get_historical: async (params, creds) => {
      if (!params.mac_address || !params.end_date) throw new Error('mac_address and end_date required');
      return awReq(`/v1/devices/${params.mac_address}?endDate=${encodeURIComponent(params.end_date)}&limit=${params.limit || 288}`, creds);
    },
    get_all_latest: async (params, creds) => {
      const devices = await awReq('/v1/devices', creds);
      return (devices || []).map(d => ({ macAddress: d.macAddress, lastData: d.lastData }));
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
