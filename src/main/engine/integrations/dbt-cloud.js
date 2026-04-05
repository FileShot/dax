/**
 * dbt Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function dbtReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = creds.host || 'cloud.getdbt.com';
  const opts = { method, hostname: host, path: `/api/v2${path}`, headers: { 'Authorization': `Token ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'dbt-cloud',
  name: 'dbt Cloud',
  category: 'data',
  icon: 'Database',
  description: 'Trigger dbt Cloud jobs, monitor runs, and access docs and artifacts.',
  configFields: [
    { key: 'api_token', label: 'Service Token', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'string', required: true },
    { key: 'host', label: 'Host (optional)', type: 'string', required: false, description: 'Defaults to cloud.getdbt.com' },
  ],
  async connect(creds) { if (!creds.api_token || !creds.account_id) throw new Error('api_token and account_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dbtReq('GET', `/accounts/${creds.account_id}/`, null, creds); return { success: true, message: `Connected — account: ${r.data?.name || creds.account_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_jobs: async (params, creds) => dbtReq('GET', `/accounts/${creds.account_id}/jobs/?project_id=${params.project_id || ''}`, null, creds),
    get_job: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return dbtReq('GET', `/accounts/${creds.account_id}/jobs/${params.job_id}/`, null, creds);
    },
    trigger_job_run: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return dbtReq('POST', `/accounts/${creds.account_id}/jobs/${params.job_id}/run/`, { cause: params.cause || 'Triggered via API', schema_override: params.schema_override }, creds);
    },
    list_runs: async (params, creds) => dbtReq('GET', `/accounts/${creds.account_id}/runs/?job_definition_id=${params.job_id || ''}&limit=${params.limit || 20}&order_by=-id`, null, creds),
    get_run: async (params, creds) => {
      if (!params.run_id) throw new Error('run_id required');
      return dbtReq('GET', `/accounts/${creds.account_id}/runs/${params.run_id}/?include_related=["trigger","job","debug_logs"]`, null, creds);
    },
    list_projects: async (params, creds) => dbtReq('GET', `/accounts/${creds.account_id}/projects/`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
