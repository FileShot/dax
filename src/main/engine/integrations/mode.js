/**
 * Mode Analytics API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function modeReq(method, path, body, creds) {
  if (!creds.workspace) throw new Error('workspace required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const auth = Buffer.from(`${creds.token}:${creds.password}`).toString('base64');
  const opts = { method, hostname: 'app.mode.com', path: `/api/${creds.workspace}${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/hal+json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'mode',
  name: 'Mode',
  category: 'data',
  icon: 'BarChart',
  description: 'Access reports, run queries, and explore data with Mode Analytics.',
  configFields: [
    { key: 'workspace', label: 'Workspace (org)', type: 'string', required: true },
    { key: 'token', label: 'API Token', type: 'string', required: true },
    { key: 'password', label: 'API Token Password', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.workspace || !creds.token || !creds.password) throw new Error('workspace, token, and password required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await modeReq('GET', '/reports?page=1', null, creds); return { success: true, message: `Connected to Mode workspace: ${creds.workspace}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_reports: async (params, creds) => modeReq('GET', `/reports?page=${params.page || 1}&per_page=${params.per_page || 20}`, null, creds),
    get_report: async (params, creds) => {
      if (!params.report_token) throw new Error('report_token required');
      return modeReq('GET', `/reports/${params.report_token}`, null, creds);
    },
    run_report: async (params, creds) => {
      if (!params.report_token) throw new Error('report_token required');
      return modeReq('POST', `/reports/${params.report_token}/runs`, {}, creds);
    },
    get_run: async (params, creds) => {
      if (!params.report_token || !params.run_token) throw new Error('report_token and run_token required');
      return modeReq('GET', `/reports/${params.report_token}/runs/${params.run_token}`, null, creds);
    },
    list_queries: async (params, creds) => {
      if (!params.report_token) throw new Error('report_token required');
      return modeReq('GET', `/reports/${params.report_token}/queries`, null, creds);
    },
    list_data_sources: async (params, creds) => modeReq('GET', '/data_sources', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
