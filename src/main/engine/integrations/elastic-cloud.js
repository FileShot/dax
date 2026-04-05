/**
 * Elastic Cloud API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function elasticReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.elastic-cloud.com', path: `/api/v1${path}`, headers: { 'Authorization': `ApiKey ${creds.api_key}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'elastic-cloud',
  name: 'Elastic Cloud',
  category: 'monitoring',
  icon: 'Search',
  description: 'Manage Elasticsearch deployments, run searches, and index documents on Elastic Cloud.',
  configFields: [{ key: 'api_key', label: 'API Key (base64 encoded id:key)', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await elasticReq('GET', '/deployments?size=1', null, creds); return { success: true, message: `${r.return_count ?? 0} deployment(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_deployments: async (params, creds) => elasticReq('GET', `/deployments?size=${params.size || 25}`, null, creds),
    get_deployment: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return elasticReq('GET', `/deployments/${params.deployment_id}`, null, creds);
    },
    get_deployment_elasticsearch: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return elasticReq('GET', `/deployments/${params.deployment_id}/elasticsearch/main-elasticsearch`, null, creds);
    },
    list_traffic_filters: async (params, creds) => elasticReq('GET', '/deployments/traffic-filter/rulesets', null, creds),
    get_costs: async (params, creds) => {
      if (!params.organization_id) throw new Error('organization_id required');
      return elasticReq('GET', `/billing/organizations/${params.organization_id}/costs/overview`, null, creds);
    },
    restart_deployment: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return elasticReq('POST', `/deployments/${params.deployment_id}/_restart`, null, creds);
    },
    shutdown_deployment: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return elasticReq('POST', `/deployments/${params.deployment_id}/_shutdown`, null, creds);
    },
    list_deployment_templates: async (params, creds) => {
      const region = params.region || 'us-east-1';
      return elasticReq('GET', `/deployments/templates?region=${region}`, null, creds);
    },
    get_deployment_plan_activity: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return elasticReq('GET', `/deployments/${params.deployment_id}/elasticsearch/main-elasticsearch/plan/activity`, null, creds);
    },
    list_extensions: async (params, creds) => elasticReq('GET', '/deployments/extensions', null, creds),
    get_deployment_metrics: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return elasticReq('GET', `/deployments/${params.deployment_id}/elasticsearch/main-elasticsearch/proxy/_cluster/stats`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
