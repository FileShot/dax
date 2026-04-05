/**
 * Xero Accounting API Integration
 */
'use strict';
const https = require('https');

function xeroApi(method, path, token, tenantId, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.xero.com', path: `/api.xro/2.0${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Xero-Tenant-Id': tenantId, 'Content-Type': 'application/json', 'Accept': 'application/json' } };
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
  id: 'xero',
  name: 'Xero',
  category: 'finance',
  icon: 'DollarSign',
  description: 'Manage invoices, contacts, and accounts in Xero.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'tenant_id', label: 'Tenant ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.tenant_id) throw new Error('Access token and tenant ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await xeroApi('GET', '/Organisation', creds.access_token, creds.tenant_id); return { success: !!r.Organisations, message: r.Organisations?.[0]?.Name ? `Connected to ${r.Organisations[0].Name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_invoices: async (params, creds) => xeroApi('GET', `/Invoices?page=${params.page || 1}`, creds.access_token, creds.tenant_id),
    get_invoice: async (params, creds) => { if (!params.invoice_id) throw new Error('invoice_id required'); return xeroApi('GET', `/Invoices/${params.invoice_id}`, creds.access_token, creds.tenant_id); },
    list_contacts: async (params, creds) => xeroApi('GET', `/Contacts?page=${params.page || 1}`, creds.access_token, creds.tenant_id),
    list_accounts: async (params, creds) => xeroApi('GET', '/Accounts', creds.access_token, creds.tenant_id),
    create_invoice: async (params, creds) => {
      if (!params.contact_id || !params.line_items) throw new Error('contact_id and line_items required');
      return xeroApi('POST', '/Invoices', creds.access_token, creds.tenant_id, { Invoices: [{ Type: params.type || 'ACCREC', Contact: { ContactID: params.contact_id }, LineItems: params.line_items, Status: params.status || 'DRAFT' }] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
