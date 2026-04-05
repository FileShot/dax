/**
 * Alchemy Web3 API Integration (JSON-RPC + Enhanced)
 */
'use strict';
const https = require('https');

function alchemyRpc(method, params, apiKey, network) {
  return new Promise((resolve, reject) => {
    const net = network || 'eth-mainnet';
    const body = JSON.stringify({ jsonrpc: '2.0', method, params: params || [], id: 1 });
    const opts = { method: 'POST', hostname: `${net}.g.alchemy.com`, path: `/v2/${apiKey}`, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function alchemyNft(path, apiKey, network) {
  return new Promise((resolve, reject) => {
    const net = network || 'eth-mainnet';
    const opts = { method: 'GET', hostname: `${net}.g.alchemy.com`, path: `/nft/v3/${apiKey}${path}` };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'alchemy',
  name: 'Alchemy',
  category: 'blockchain',
  icon: 'Zap',
  description: 'Access enhanced Ethereum JSON-RPC and NFT data via Alchemy.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'network', label: 'Network (e.g. eth-mainnet, polygon-mainnet)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await alchemyRpc('eth_blockNumber', [], creds.api_key, creds.network); return { success: !!r.result, message: r.error?.message || `Connected — block ${parseInt(r.result, 16)}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_balance: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return alchemyRpc('eth_getBalance', [params.address, 'latest'], creds.api_key, creds.network);
    },
    get_block: async (params, creds) => {
      const tag = params.block_number ? `0x${parseInt(params.block_number).toString(16)}` : 'latest';
      return alchemyRpc('eth_getBlockByNumber', [tag, false], creds.api_key, creds.network);
    },
    get_transaction: async (params, creds) => {
      if (!params.tx_hash) throw new Error('tx_hash required');
      return alchemyRpc('eth_getTransactionByHash', [params.tx_hash], creds.api_key, creds.network);
    },
    get_nfts_for_owner: async (params, creds) => {
      if (!params.owner) throw new Error('owner address required');
      const qs = `?owner=${encodeURIComponent(params.owner)}&pageSize=${params.page_size || 10}`;
      return alchemyNft(`/getNFTsForOwner${qs}`, creds.api_key, creds.network);
    },
    get_token_balances: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return alchemyRpc('alchemy_getTokenBalances', [params.address, params.contract_addresses || 'erc20'], creds.api_key, creds.network);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
