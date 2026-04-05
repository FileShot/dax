/**
 * ATTOM Property Data API Integration
 */
'use strict';
const https = require('https');

function attomGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.gateway.attomdata.com', path, headers: { 'apikey': apiKey, 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'attom',
  name: 'ATTOM Property Data',
  category: 'realestate',
  icon: 'Home',
  description: 'Access ATTOM property details, AVM, sales history, and neighborhood data.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await attomGet('/propertyapi/v1.0.0/property/basicprofile?address1=4 Yawkey Way&address2=Boston, MA 02215', creds.api_key); if (r.status?.msg === 'SuccessWithResult') return { success: true, message: 'Connected to ATTOM' }; return { success: r.status?.code === 0, message: r.status?.msg || 'ATTOM API connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_basic_profile: async (params, creds) => {
      if (!params.address1 || !params.address2) throw new Error('address1 and address2 required');
      const qs = new URLSearchParams({ address1: params.address1, address2: params.address2 }).toString();
      return attomGet(`/propertyapi/v1.0.0/property/basicprofile?${qs}`, creds.api_key);
    },
    get_avm: async (params, creds) => {
      if (!params.address1 || !params.address2) throw new Error('address1 and address2 required');
      const qs = new URLSearchParams({ address1: params.address1, address2: params.address2 }).toString();
      return attomGet(`/propertyapi/v1.0.0/attomavm/detail?${qs}`, creds.api_key);
    },
    get_sales_history: async (params, creds) => {
      if (!params.address1 || !params.address2) throw new Error('address1 and address2 required');
      const qs = new URLSearchParams({ address1: params.address1, address2: params.address2 }).toString();
      return attomGet(`/propertyapi/v1.0.0/saleshistory/detail?${qs}`, creds.api_key);
    },
    search_properties: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.postalcode && { postalcode: params.postalcode }), ...(params.county && { countyFipsCode: params.county }), page: String(params.page || 1), pagesize: String(params.pagesize || 10) }).toString();
      return attomGet(`/propertyapi/v1.0.0/property/address?${qs}`, creds.api_key);
    },
    get_school_detail: async (params, creds) => {
      if (!params.address1 || !params.address2) throw new Error('address1 and address2 required');
      const qs = new URLSearchParams({ address1: params.address1, address2: params.address2 }).toString();
      return attomGet(`/propertyapi/v1.0.0/school/detail?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
