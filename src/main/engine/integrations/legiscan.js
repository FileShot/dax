/**
 * LegiScan Legislative Bill Tracking Integration
 */
'use strict';
const https = require('https');

function legiscanGet(key, op, params) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ key, op, ...params }).toString();
    const opts = { method: 'GET', hostname: 'api.legiscan.com', path: `/?${qs}`, headers: { 'Accept': 'application/json' } };
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
  id: 'legiscan',
  name: 'LegiScan',
  category: 'legal',
  icon: 'ScrollText',
  description: 'Track US federal and state legislation, bill text, votes, and sponsor data via LegiScan.',
  configFields: [{ key: 'api_key', label: 'API Key (free at legiscan.com)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await legiscanGet(creds.api_key, 'getSessionList', { state: 'US' }); if (r.status === 'ERROR') return { success: false, message: r.alert?.message || 'Auth failed' }; return { success: true, message: 'Connected to LegiScan' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_bills: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return legiscanGet(creds.api_key, 'getSearch', { query: params.query, state: params.state || 'ALL', year: params.year || '2', page: String(params.page || 1) });
    },
    get_bill: async (params, creds) => {
      if (!params.bill_id) throw new Error('bill_id required');
      return legiscanGet(creds.api_key, 'getBill', { id: String(params.bill_id) });
    },
    get_bill_text: async (params, creds) => {
      if (!params.doc_id) throw new Error('doc_id required');
      return legiscanGet(creds.api_key, 'getBillText', { id: String(params.doc_id) });
    },
    get_session_list: async (params, creds) => {
      return legiscanGet(creds.api_key, 'getSessionList', { state: params.state || 'ALL' });
    },
    get_bill_list: async (params, creds) => {
      if (!params.state || !params.year) throw new Error('state and year required');
      return legiscanGet(creds.api_key, 'getMasterListRaw', { state: params.state, year: String(params.year) });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
