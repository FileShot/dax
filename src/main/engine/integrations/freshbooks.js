/**
 * FreshBooks API Integration
 */
'use strict';
const https = require('https');

function freshbooksApi(method, accountId, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.freshbooks.com', path: `/accounting/account/${accountId}${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' } };
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
  id: 'freshbooks',
  name: 'FreshBooks',
  category: 'finance',
  icon: 'BookOpen',
  description: 'Manage invoices, expenses, and clients in FreshBooks.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.account_id) throw new Error('Access token and account ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await freshbooksApi('GET', creds.account_id, '/users/clients?per_page=1', creds.access_token); return { success: !!r.response, message: r.response ? 'Connected to FreshBooks' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_clients: async (params, creds) => freshbooksApi('GET', creds.account_id, `/users/clients?per_page=${params.limit || 25}&page=${params.page || 1}`, creds.access_token),
    get_client: async (params, creds) => { if (!params.client_id) throw new Error('client_id required'); return freshbooksApi('GET', creds.account_id, `/users/clients/${params.client_id}`, creds.access_token); },
    list_invoices: async (params, creds) => freshbooksApi('GET', creds.account_id, `/invoices/invoices?per_page=${params.limit || 25}&page=${params.page || 1}`, creds.access_token),
    get_invoice: async (params, creds) => { if (!params.invoice_id) throw new Error('invoice_id required'); return freshbooksApi('GET', creds.account_id, `/invoices/invoices/${params.invoice_id}`, creds.access_token); },
    list_expenses: async (params, creds) => freshbooksApi('GET', creds.account_id, `/expenses/expenses?per_page=${params.limit || 25}&page=${params.page || 1}`, creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
