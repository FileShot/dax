/**
 * Moralis Web3 API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function moralisReq(path, creds) {
  return makeRequest({ method: 'GET', hostname: 'deep-index.moralis.io', path, headers: { 'X-API-Key': creds.api_key, 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'moralis',
  name: 'Moralis',
  category: 'blockchain',
  icon: 'Globe',
  description: 'Query multi-chain blockchain data — tokens, NFTs, DeFi positions, and transactions via Moralis.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('api_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await moralisReq('/api/v2.2/web3/version', creds); return { success: true, message: `Moralis API v${r.version || '?'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_wallet_tokens: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const chain = params.chain || 'eth';
      return moralisReq(`/api/v2.2/${params.address}/erc20?chain=${chain}`, creds);
    },
    get_nfts: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const chain = params.chain || 'eth';
      return moralisReq(`/api/v2.2/${params.address}/nft?chain=${chain}&format=decimal&limit=${params.limit || 20}`, creds);
    },
    get_transactions: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const chain = params.chain || 'eth';
      return moralisReq(`/api/v2.2/${params.address}?chain=${chain}&limit=${params.limit || 20}`, creds);
    },
    get_token_price: async (params, creds) => {
      if (!params.token_address) throw new Error('token_address required');
      const chain = params.chain || 'eth';
      return moralisReq(`/api/v2.2/erc20/${params.token_address}/price?chain=${chain}`, creds);
    },
    get_defi_positions: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      const chain = params.chain || 'eth';
      return moralisReq(`/api/v2.2/wallets/${params.address}/defi/positions?chain=${chain}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
