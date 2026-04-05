/**
 * CourtListener Case Law & PACER API Integration (free with token)
 */
'use strict';
const https = require('https');

function clReq(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'www.courtlistener.com', path: `/api/rest/v3${path}`, headers: { ...(token && { 'Authorization': `Token ${token}` }), 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'courtlistener',
  name: 'CourtListener',
  category: 'legal',
  icon: 'Scale',
  description: 'Search US case law, opinions, dockets, and judge data via CourtListener API.',
  configFields: [{ key: 'api_token', label: 'API Token (optional — required for higher rate limits)', type: 'password', required: false }],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await clReq('GET', '/courts/?format=json&limit=1', creds.api_token); if (r.detail) return { success: false, message: r.detail }; return { success: true, message: 'Connected to CourtListener' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_opinions: async (params, creds) => {
      if (!params.q) throw new Error('q (search query) required');
      const qs = new URLSearchParams({ q: params.q, type: 'o', order_by: params.order_by || 'score desc', stat_Precedential: 'on', page: String(params.page || 1) }).toString();
      return clReq('GET', `/search/?${qs}&format=json`, creds.api_token);
    },
    get_opinion: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return clReq('GET', `/opinions/${params.id}/?format=json`, creds.api_token);
    },
    get_docket: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return clReq('GET', `/dockets/${params.id}/?format=json`, creds.api_token);
    },
    search_dockets: async (params, creds) => {
      if (!params.q) throw new Error('q required');
      const qs = new URLSearchParams({ q: params.q, type: 'r', ...(params.court && { court: params.court }), page: String(params.page || 1) }).toString();
      return clReq('GET', `/search/?${qs}&format=json`, creds.api_token);
    },
    list_courts: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 50), ...(params.jurisdiction && { jurisdiction: params.jurisdiction }) }).toString();
      return clReq('GET', `/courts/?${qs}&format=json`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
