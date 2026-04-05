/**
 * The Graph Subgraph Query Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function graphReq(path, body, creds) {
  const bodyStr = JSON.stringify(body);
  return makeRequest({ method: 'POST', hostname: 'gateway.thegraph.com', path, headers: { 'Authorization': `Bearer ${creds.api_key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } }, bodyStr);
}

module.exports = {
  id: 'the-graph',
  name: 'The Graph',
  category: 'blockchain',
  icon: 'BarChart2',
  description: 'Query blockchain data via The Graph subgraph API using GraphQL.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const r = await graphReq('/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp', { query: '{ _meta { block { number } } }' }, creds);
      return { success: true, message: 'The Graph query successful' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    query_subgraph: async (params, creds) => {
      if (!params.subgraph_id || !params.query) throw new Error('subgraph_id and query required');
      return graphReq(`/api/subgraphs/id/${params.subgraph_id}`, { query: params.query, variables: params.variables || {} }, creds);
    },
    query_by_deployment: async (params, creds) => {
      if (!params.deployment_id || !params.query) throw new Error('deployment_id and query required');
      return graphReq(`/api/deployments/id/${params.deployment_id}`, { query: params.query, variables: params.variables || {} }, creds);
    },
    get_status: async (params, creds) => {
      if (!params.subgraph_id) throw new Error('subgraph_id required');
      return graphReq('/index-node/graphql', { query: `{ indexingStatusForCurrentVersion(subgraphName: "${params.subgraph_id}") { synced health fatalError { message } chains { latestBlock { number } } } }` }, creds);
    },
    query_uniswap: async (params, creds) => {
      // convenience: query Uniswap v3 subgraph
      const q = params.query || '{ pools(first: 5, orderBy: volumeUSD, orderDirection: desc) { id token0 { symbol } token1 { symbol } volumeUSD } }';
      return graphReq('/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV', { query: q }, creds);
    },
    query_aave: async (params, creds) => {
      const q = params.query || '{ markets(first: 5) { id name inputToken { symbol } totalValueLockedUSD } }';
      return graphReq('/api/subgraphs/id/JCNWRypm7FYwV8fx5HhzZPSFaMxgkPuw4TnR3Gpi81zk', { query: q }, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
