/**
 * PhantomBuster Automation API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function pbReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.phantombuster.com', path: `/api/v2${path}`, headers: { 'X-Phantombuster-Key': creds.api_key, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'phantombuster',
  name: 'PhantomBuster',
  category: 'marketing',
  icon: 'Ghost',
  description: 'Automate LinkedIn prospecting, scraping, and lead generation with PhantomBuster.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pbReq('GET', '/me', null, creds); return { success: true, message: `User: ${r.email || r.id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_phantoms: async (params, creds) => pbReq('GET', `/phantoms?page=${params.page || 1}&perPage=${params.per_page || 25}`, null, creds),
    get_phantom: async (params, creds) => {
      if (!params.phantom_id) throw new Error('phantom_id required');
      return pbReq('GET', `/phantoms/${params.phantom_id}`, null, creds);
    },
    launch_phantom: async (params, creds) => {
      if (!params.phantom_id) throw new Error('phantom_id required');
      return pbReq('POST', `/phantoms/${params.phantom_id}/launch`, { arguments: params.arguments || {} }, creds);
    },
    get_output: async (params, creds) => {
      if (!params.phantom_id) throw new Error('phantom_id required');
      return pbReq('GET', `/phantoms/${params.phantom_id}/output`, null, creds);
    },
    get_me: async (params, creds) => pbReq('GET', '/me', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
