/**
 * Hygraph (GraphQL) Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function hygraphReq(query, variables, creds) {
  const body = JSON.stringify({ query, variables: variables || {} });
  const url = new URL(creds.api_endpoint);
  const opts = { method: 'POST', hostname: url.hostname, path: url.pathname, headers: { 'Authorization': `Bearer ${creds.auth_token}`, 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
  return makeRequest(opts, body);
}

module.exports = {
  id: 'hygraph',
  name: 'Hygraph',
  category: 'cms',
  icon: 'Layers',
  description: 'Query and mutate content in Hygraph (formerly GraphCMS) via GraphQL API.',
  configFields: [
    { key: 'api_endpoint', label: 'API Endpoint URL', type: 'string', required: true, description: 'GraphQL endpoint e.g. https://us-east-1.cdn.hygraph.com/content/xxx/master' },
    { key: 'auth_token', label: 'Permanent Auth Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_endpoint || !creds.auth_token) throw new Error('api_endpoint and auth_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await hygraphReq('{ __typename }', {}, creds);
      return { success: true, message: `Connected to Hygraph endpoint` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    graphql_query: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return hygraphReq(params.query, params.variables || {}, creds);
    },
    graphql_mutation: async (params, creds) => {
      if (!params.mutation) throw new Error('mutation required');
      return hygraphReq(params.mutation, params.variables || {}, creds);
    },
    list_content_models: async (params, creds) => hygraphReq('{ __schema { types { name kind } } }', {}, creds),
    get_schema_info: async (params, creds) => hygraphReq('{ __schema { queryType { name } mutationType { name } subscriptionType { name } } }', {}, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
