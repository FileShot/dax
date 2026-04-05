/**
 * Covalent Web3 Data API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function covaReq(path, creds) {
  const auth = 'Basic ' + Buffer.from(`${creds.api_key}:`).toString('base64');
  return makeRequest({ method: 'GET', hostname: 'api.covalenthq.com', path, headers: { 'Authorization': auth, 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'covalent',
  name: 'Covalent',
  category: 'blockchain',
  icon: 'Database',
  description: 'Query multi-chain blockchain data — token balances, NFTs, transactions, and events via Covalent.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await covaReq('/v1/1/block/latest/', creds); return { success: true, message: `Covalent: latest ETH block ${r.data?.items?.[0]?.height || 'ok'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_token_balances: async (params, creds) => {
      if (!params.chain_name || !params.address) throw new Error('chain_name and address required');
      return covaReq(`/v1/${params.chain_name}/address/${params.address}/balances_v2/?quote-currency=${params.quote_currency || 'USD'}`, creds);
    },
    get_transactions: async (params, creds) => {
      if (!params.chain_name || !params.address) throw new Error('chain_name and address required');
      return covaReq(`/v1/${params.chain_name}/address/${params.address}/transactions_v3/?page-size=${params.page_size || 10}`, creds);
    },
    get_nft_metadata: async (params, creds) => {
      if (!params.chain_name || !params.contract_address || !params.token_id) throw new Error('chain_name, contract_address, and token_id required');
      return covaReq(`/v1/${params.chain_name}/tokens/${params.contract_address}/nft_metadata/${params.token_id}/`, creds);
    },
    get_block: async (params, creds) => {
      if (!params.chain_name || !params.block_height) throw new Error('chain_name and block_height required');
      return covaReq(`/v1/${params.chain_name}/block_v2/${params.block_height}/`, creds);
    },
    get_log_events: async (params, creds) => {
      if (!params.chain_name || !params.contract_address) throw new Error('chain_name and contract_address required');
      return covaReq(`/v1/${params.chain_name}/events/address/${params.contract_address}/?starting-block=${params.starting_block || 'latest'}&ending-block=${params.ending_block || 'latest'}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
