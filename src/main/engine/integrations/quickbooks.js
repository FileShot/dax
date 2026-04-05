/**
 * QuickBooks Online API Integration
 */
'use strict';
const https = require('https');

function qbApi(method, realmId, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'quickbooks.api.intuit.com', path: `/v3/company/${realmId}${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'quickbooks',
  name: 'QuickBooks',
  category: 'finance',
  icon: 'Receipt',
  description: 'Manage invoices, customers, and accounting in QuickBooks Online.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'realm_id', label: 'Realm (Company) ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.realm_id) throw new Error('Access token and realm ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await qbApi('GET', creds.realm_id, '/companyinfo/' + creds.realm_id, creds.access_token); return { success: !!r.CompanyInfo, message: r.CompanyInfo ? `Connected to ${r.CompanyInfo.CompanyName}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query: async (params, creds) => {
      if (!params.query) throw new Error('query (SQL-like) required');
      return qbApi('GET', creds.realm_id, `/query?query=${encodeURIComponent(params.query)}`, creds.access_token);
    },
    get_invoice: async (params, creds) => { if (!params.invoice_id) throw new Error('invoice_id required'); return qbApi('GET', creds.realm_id, `/invoice/${params.invoice_id}`, creds.access_token); },
    list_customers: async (params, creds) => qbApi('GET', creds.realm_id, `/query?query=${encodeURIComponent(`SELECT * FROM Customer MAXRESULTS ${params.limit || 100}`)}`, creds.access_token),
    list_invoices: async (params, creds) => qbApi('GET', creds.realm_id, `/query?query=${encodeURIComponent(`SELECT * FROM Invoice MAXRESULTS ${params.limit || 100}`)}`, creds.access_token),
    get_company_info: async (params, creds) => qbApi('GET', creds.realm_id, `/companyinfo/${creds.realm_id}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
