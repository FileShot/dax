/**
 * Etherscan Blockchain Explorer API Integration
 */
'use strict';
const https = require('https');

function etherscanRequest(params, apiKey) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ ...params, apikey: apiKey }).toString();
    const opts = { method: 'GET', hostname: 'api.etherscan.io', path: `/api?${qs}` };
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
  id: 'etherscan',
  name: 'Etherscan',
  category: 'blockchain',
  icon: 'Blocks',
  description: 'Query Ethereum blockchain data — balances, transactions, tokens, and gas prices via Etherscan.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await etherscanRequest({ module: 'stats', action: 'ethsupply' }, creds.api_key); return { success: r.status === '1', message: r.message || 'Connected to Etherscan' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_balance: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return etherscanRequest({ module: 'account', action: 'balance', address: params.address, tag: params.tag || 'latest' }, creds.api_key);
    },
    get_transactions: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return etherscanRequest({ module: 'account', action: 'txlist', address: params.address, startblock: params.startblock || '0', endblock: params.endblock || '99999999', sort: params.sort || 'asc', page: String(params.page || 1), offset: String(params.offset || 20) }, creds.api_key);
    },
    get_token_transfers: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return etherscanRequest({ module: 'account', action: 'tokentx', address: params.address, ...(params.contractaddress && { contractaddress: params.contractaddress }), page: String(params.page || 1), offset: String(params.offset || 20) }, creds.api_key);
    },
    get_gas_price: async (params, creds) => {
      return etherscanRequest({ module: 'gastracker', action: 'gasoracle' }, creds.api_key);
    },
    get_block: async (params, creds) => {
      if (!params.blockno) throw new Error('blockno required');
      return etherscanRequest({ module: 'proxy', action: 'eth_getBlockByNumber', tag: `0x${parseInt(params.blockno).toString(16)}`, boolean: 'true' }, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
