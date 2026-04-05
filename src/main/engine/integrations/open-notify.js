/**
 * Open Notify API Integration (ISS tracking, free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function notifyGet(path) {
  const opts = { method: 'GET', hostname: 'api.open-notify.org', path, headers: { 'Accept': 'application/json' } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'open-notify',
  name: 'Open Notify',
  category: 'government',
  icon: 'Rocket',
  description: 'Track the International Space Station position and crew members in real-time.',
  configFields: [],
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(_creds) {
    try { const r = await notifyGet('/astros.json'); if (r.people) return { success: true, message: `Connected — ${r.number} astronaut(s) currently in space` }; return { success: false, message: 'Unexpected response' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_iss_position: async (params, _creds) => {
      return notifyGet('/iss-now.json');
    },
    get_astronauts: async (params, _creds) => {
      return notifyGet('/astros.json');
    },
    get_iss_pass_times: async (params, _creds) => {
      if (!params.lat || !params.lon) throw new Error('lat and lon required');
      const qs = new URLSearchParams({ lat: String(params.lat), lon: String(params.lon), ...(params.alt && { alt: String(params.alt) }), ...(params.n && { n: String(params.n) }) }).toString();
      return notifyGet(`/iss-pass.json?${qs}`);
    },
    get_iss_location: async (params, _creds) => {
      return notifyGet('/iss-now.json');
    },
    get_crew_count: async (params, _creds) => {
      const r = await notifyGet('/astros.json');
      return { number: r.number, crew: r.people };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
