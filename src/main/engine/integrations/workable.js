/**
 * Workable Recruiting API Integration
 */
'use strict';
const https = require('https');

function workableRequest(method, path, body, apiToken, subdomain) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: `${subdomain}.workable.com`, path: `/spi/v3${path}`, headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'workable',
  name: 'Workable',
  category: 'hr',
  icon: 'Briefcase',
  description: 'Manage job postings, candidates, and interviews with Workable recruiting platform.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
    { key: 'subdomain', label: 'Company Subdomain', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_token || !creds.subdomain) throw new Error('API token and subdomain required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await workableRequest('GET', '/account', null, creds.api_token, creds.subdomain); return { success: !!r.subdomain, message: r.errors ? r.errors.join(', ') : `Connected — ${r.name || creds.subdomain}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_jobs: async (params, creds) => {
      const qs = `?limit=${params.limit || 20}${params.state ? `&state=${params.state}` : ''}`;
      return workableRequest('GET', `/jobs${qs}`, null, creds.api_token, creds.subdomain);
    },
    get_job: async (params, creds) => {
      if (!params.shortcode) throw new Error('shortcode required');
      return workableRequest('GET', `/jobs/${params.shortcode}`, null, creds.api_token, creds.subdomain);
    },
    list_candidates: async (params, creds) => {
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.job_shortcode && { job_shortcode: params.job_shortcode }), ...(params.state && { state: params.state }) }).toString();
      return workableRequest('GET', `/candidates?${qs}`, null, creds.api_token, creds.subdomain);
    },
    get_candidate: async (params, creds) => {
      if (!params.candidate_id) throw new Error('candidate_id required');
      return workableRequest('GET', `/candidates/${params.candidate_id}`, null, creds.api_token, creds.subdomain);
    },
    list_stages: async (params, creds) => {
      const qs = params.job_shortcode ? `/${params.job_shortcode}/stages` : '';
      return workableRequest('GET', params.job_shortcode ? `/jobs${qs}` : '/stages', null, creds.api_token, creds.subdomain);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
