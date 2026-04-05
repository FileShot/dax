/**
 * Railway Cloud Deployment API Integration
 */
'use strict';
const https = require('https');
const { makeRequest } = require('../../engine/integration-utils');

function railwayPost(query, variables, token) {
  const body = JSON.stringify({ query, variables });
  const opts = { method: 'POST', hostname: 'backboard.railway.app', path: '/graphql/v2', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
  return makeRequest(opts, body);
}

module.exports = {
  id: 'railway',
  name: 'Railway',
  category: 'developer',
  icon: 'Train',
  description: 'Manage Railway projects, services, and deployments via the Railway GraphQL API.',
  configFields: [{ key: 'api_key', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await railwayPost('{ me { id name email } }', {}, creds.api_key); if (r.errors) return { success: false, message: r.errors[0].message }; return { success: true, message: `Connected as ${r.data?.me?.name || r.data?.me?.email}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => {
      return railwayPost('{ projects { edges { node { id name createdAt services { edges { node { id name } } } } } } }', {}, creds.api_key);
    },
    get_project: async (params, creds) => {
      if (!params.id) throw new Error('project id required');
      return railwayPost('query($id: String!) { project(id: $id) { id name createdAt environments { edges { node { id name } } } services { edges { node { id name } } } } }', { id: params.id }, creds.api_key);
    },
    create_deployment: async (params, creds) => {
      if (!params.service_id || !params.environment_id) throw new Error('service_id and environment_id required');
      return railwayPost('mutation($input: DeploymentCreateInput!) { deploymentCreate(input: $input) { id status } }', { input: { serviceId: params.service_id, environmentId: params.environment_id } }, creds.api_key);
    },
    get_service: async (params, creds) => {
      if (!params.id) throw new Error('service id required');
      return railwayPost('query($id: String!) { service(id: $id) { id name projectId deployments { edges { node { id status createdAt } } } } }', { id: params.id }, creds.api_key);
    },
    list_deployments: async (params, creds) => {
      if (!params.service_id) throw new Error('service_id required');
      return railwayPost('query($id: String!) { service(id: $id) { deployments { edges { node { id status createdAt url } } } } }', { id: params.service_id }, creds.api_key);
    },
    delete_project: async (params, creds) => {
      if (!params.id) throw new Error('project id required');
      return railwayPost('mutation($id: String!) { projectDelete(id: $id) }', { id: params.id }, creds.api_key);
    },
    create_project: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return railwayPost('mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { id name } }', { input: { name: params.name, ...(params.description && { description: params.description }) } }, creds.api_key);
    },
    list_environments: async (params, creds) => {
      if (!params.project_id) throw new Error('project_id required');
      return railwayPost('query($id: String!) { project(id: $id) { environments { edges { node { id name } } } } }', { id: params.project_id }, creds.api_key);
    },
    get_deployment: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return railwayPost('query($id: String!) { deployment(id: $id) { id status createdAt meta url } }', { id: params.deployment_id }, creds.api_key);
    },
    restart_deployment: async (params, creds) => {
      if (!params.deployment_id) throw new Error('deployment_id required');
      return railwayPost('mutation($id: String!) { deploymentRestart(id: $id) { id status } }', { id: params.deployment_id }, creds.api_key);
    },
    set_variable: async (params, creds) => {
      if (!params.project_id || !params.environment_id || !params.name || !params.value) throw new Error('project_id, environment_id, name, and value required');
      return railwayPost('mutation($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }', { input: { projectId: params.project_id, environmentId: params.environment_id, variables: { [params.name]: params.value } } }, creds.api_key);
    },
    get_variables: async (params, creds) => {
      if (!params.project_id || !params.environment_id || !params.service_id) throw new Error('project_id, environment_id, and service_id required');
      return railwayPost('query($pId: String!, $eId: String!, $sId: String!) { variables(projectId: $pId, environmentId: $eId, serviceId: $sId) }', { pId: params.project_id, eId: params.environment_id, sId: params.service_id }, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
