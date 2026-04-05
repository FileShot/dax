/**
 * Teamtailor ATS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function ttReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.teamtailor.com', path: `/v1${path}`, headers: { 'Authorization': `Token token=${creds.api_key}`, 'X-Api-Version': '20240404', 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'teamtailor',
  name: 'Teamtailor',
  category: 'hr',
  icon: 'Users',
  description: 'Manage job listings, candidates, and recruitment pipelines via Teamtailor ATS.',
  configFields: [{ key: 'api_key', label: 'API Key', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ttReq('GET', '/jobs?page[size]=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} job(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_jobs: async (params, creds) => ttReq('GET', `/jobs?page[size]=${params.page_size || 20}&page[number]=${params.page || 1}&filter[status]=${params.status || 'published'}`, null, creds),
    get_job: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return ttReq('GET', `/jobs/${params.id}`, null, creds);
    },
    list_candidates: async (params, creds) => ttReq('GET', `/candidates?page[size]=${params.page_size || 20}&page[number]=${params.page || 1}`, null, creds),
    get_candidate: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return ttReq('GET', `/candidates/${params.id}`, null, creds);
    },
    list_job_applications: async (params, creds) => ttReq('GET', `/job-applications?page[size]=${params.page_size || 20}${params.job_id ? `&filter[job]=${params.job_id}` : ''}`, null, creds),
    list_departments: async (params, creds) => ttReq('GET', '/departments', null, creds),
    list_stages: async (params, creds) => ttReq('GET', '/stages', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
