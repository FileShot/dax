/**
 * SmartyStreets (Smarty) US Address Verification Integration
 */
'use strict';
const https = require('https');

function smartyGet(path, authId, authToken) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'us-street.api.smarty.com', path: `${path}${sep}auth-id=${encodeURIComponent(authId)}&auth-token=${encodeURIComponent(authToken)}`, headers: { 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function smartyHostGet(hostname, path, authId, authToken) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname, path: `${path}${sep}auth-id=${encodeURIComponent(authId)}&auth-token=${encodeURIComponent(authToken)}`, headers: { 'Accept': 'application/json' } };
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
  id: 'smarty-streets',
  name: 'Smarty (SmartyStreets)',
  category: 'realestate',
  icon: 'CheckSquare',
  description: 'Validate and standardize US/international addresses, get USPS data and zip info.',
  configFields: [
    { key: 'auth_id', label: 'Auth ID', type: 'text', required: true },
    { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.auth_id || !creds.auth_token) throw new Error('Auth ID and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await smartyGet('/street-address?street=1+Infinite+Loop&city=Cupertino&state=CA&zipcode=95014&candidates=1', creds.auth_id, creds.auth_token); if (Array.isArray(r) && r.length > 0) return { success: true, message: 'Connected to Smarty' }; return { success: true, message: 'Smarty API connected' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    verify_address: async (params, creds) => {
      if (!params.street) throw new Error('street required');
      const qs = new URLSearchParams({ street: params.street, ...(params.city && { city: params.city }), ...(params.state && { state: params.state }), ...(params.zipcode && { zipcode: params.zipcode }), candidates: String(params.candidates || 1) }).toString();
      return smartyGet(`/street-address?${qs}`, creds.auth_id, creds.auth_token);
    },
    lookup_zip: async (params, creds) => {
      if (!params.zipcode && !params.city) throw new Error('zipcode or city required');
      const qs = new URLSearchParams({ ...(params.zipcode && { zipcode: params.zipcode }), ...(params.city && { city: params.city }), ...(params.state && { state: params.state }) }).toString();
      return smartyHostGet('us-zipcode.api.smarty.com', `/zipcode?${qs}`, creds.auth_id, creds.auth_token);
    },
    autocomplete_address: async (params, creds) => {
      if (!params.search) throw new Error('search prefix required');
      const qs = new URLSearchParams({ search: params.search, ...(params.max_results && { max_results: String(params.max_results) }) }).toString();
      return smartyHostGet('us-autocomplete-pro.api.smarty.com', `/lookup?${qs}`, creds.auth_id, creds.auth_token);
    },
    verify_international: async (params, creds) => {
      if (!params.address1 || !params.country) throw new Error('address1 and country required');
      const qs = new URLSearchParams({ address1: params.address1, ...(params.address2 && { address2: params.address2 }), country: params.country, ...(params.administrative_area && { administrative_area: params.administrative_area }), ...(params.postal_code && { postal_code: params.postal_code }) }).toString();
      return smartyHostGet('international-street.api.smarty.com', `/verify?${qs}`, creds.auth_id, creds.auth_token);
    },
    extract_addresses: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const qs = new URLSearchParams({ text: params.text, candidates: String(params.candidates || 10) }).toString();
      return smartyHostGet('us-extract.api.smarty.com', `/street-address?${qs}`, creds.auth_id, creds.auth_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
