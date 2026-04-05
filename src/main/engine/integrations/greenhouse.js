/**
 * Greenhouse Recruiting API Integration
 */
'use strict';
const https = require('https');

function greenhouseRequest(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'harvest.greenhouse.io', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'greenhouse',
  name: 'Greenhouse',
  category: 'hr',
  icon: 'UserPlus',
  description: 'Manage job postings, candidates, and applications with Greenhouse recruiting software.',
  configFields: [
    { key: 'api_key', label: 'Harvest API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('Harvest API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await greenhouseRequest('GET', '/users?per_page=1', null, creds.api_key); return { success: Array.isArray(r), message: Array.isArray(r) ? 'Connected to Greenhouse' : JSON.stringify(r) }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_candidates: async (params, creds) => {
      const qs = `?per_page=${params.per_page || 20}&page=${params.page || 1}${params.job_id ? `&job_id=${params.job_id}` : ''}`;
      return greenhouseRequest('GET', `/candidates${qs}`, null, creds.api_key);
    },
    get_candidate: async (params, creds) => {
      if (!params.candidate_id) throw new Error('candidate_id required');
      return greenhouseRequest('GET', `/candidates/${params.candidate_id}`, null, creds.api_key);
    },
    list_jobs: async (params, creds) => {
      const qs = `?per_page=${params.per_page || 20}&page=${params.page || 1}${params.status ? `&status=${params.status}` : ''}`;
      return greenhouseRequest('GET', `/jobs${qs}`, null, creds.api_key);
    },
    get_job: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return greenhouseRequest('GET', `/jobs/${params.job_id}`, null, creds.api_key);
    },
    list_applications: async (params, creds) => {
      const qs = `?per_page=${params.per_page || 20}&page=${params.page || 1}${params.candidate_id ? `&candidate_id=${params.candidate_id}` : ''}${params.job_id ? `&job_id=${params.job_id}` : ''}`;
      return greenhouseRequest('GET', `/applications${qs}`, null, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
