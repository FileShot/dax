/**
 * Stitch Data (now part of Talend) Pipeline API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function stitchReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.stitchdata.com', path: `/v4${path}`, headers: { 'Authorization': `Bearer ${creds.api_access_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'stitch',
  name: 'Stitch',
  category: 'data',
  icon: 'GitMerge',
  description: 'Manage data sources, reports, and extraction jobs with Stitch Data pipeline.',
  configFields: [{ key: 'api_access_token', label: 'API Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_access_token) throw new Error('api_access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await stitchReq('GET', '/sources?per_page=1', null, creds); return { success: true, message: `Connected — ${r.data?.length ?? 0} source(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_sources: async (params, creds) => stitchReq('GET', `/sources?per_page=${params.per_page || 25}&page=${params.page || 1}`, null, creds),
    get_source: async (params, creds) => {
      if (!params.source_id) throw new Error('source_id required');
      return stitchReq('GET', `/sources/${params.source_id}`, null, creds);
    },
    get_source_report: async (params, creds) => {
      if (!params.source_id) throw new Error('source_id required');
      return stitchReq('GET', `/sources/${params.source_id}/last-replication-job`, null, creds);
    },
    list_destinations: async (params, creds) => stitchReq('GET', '/destinations', null, creds),
    get_source_streams: async (params, creds) => {
      if (!params.source_id) throw new Error('source_id required');
      return stitchReq('GET', `/sources/${params.source_id}/streams`, null, creds);
    },
    list_notification_settings: async (params, creds) => stitchReq('GET', '/notifications/customs', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
