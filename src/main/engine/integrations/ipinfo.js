/**
 * IPInfo Integration
 */
'use strict';
const https = require('https');

function ipinfoRequest(path, token) {
  return new Promise((resolve, reject) => {
    const separator = path.includes('?') ? '&' : '?';
    const opts = { method: 'GET', hostname: 'ipinfo.io', path: `${path}${token ? `${separator}token=${encodeURIComponent(token)}` : ''}`, headers: { 'Accept': 'application/json' } };
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
  id: 'ipinfo',
  name: 'IPInfo',
  category: 'maps',
  icon: 'Network',
  description: 'Look up geolocation, ASN, and network details for any IP address using IPInfo.',
  configFields: [
    { key: 'token', label: 'Access Token (optional for free tier)', type: 'password', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ipinfoRequest('/json', creds.token || null); return { success: !!r.ip, message: r.error ? r.error.message : `Connected — your IP: ${r.ip}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_ip_info: async (params, creds) => {
      if (!params.ip) throw new Error('ip required');
      return ipinfoRequest(`/${params.ip}/json`, creds.token || null);
    },
    get_my_ip: async (params, creds) => {
      return ipinfoRequest('/json', creds.token || null);
    },
    get_ip_field: async (params, creds) => {
      if (!params.ip || !params.field) throw new Error('ip and field required');
      return ipinfoRequest(`/${params.ip}/${params.field}`, creds.token || null);
    },
    batch_lookup: async (params, creds) => {
      if (!params.ips || !Array.isArray(params.ips)) throw new Error('ips array required');
      const results = await Promise.all(params.ips.map(ip => ipinfoRequest(`/${ip}/json`, creds.token || null)));
      return { results: results.map((r, i) => ({ ip: params.ips[i], ...r })) };
    },
    get_asn: async (params, creds) => {
      if (!params.asn) throw new Error('asn required (e.g. "AS13335")');
      return ipinfoRequest(`/${params.asn}/json`, creds.token || null);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
