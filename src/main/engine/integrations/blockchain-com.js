/**
 * Blockchain.com API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function bcReq(hostname, path) {
  return makeRequest({ method: 'GET', hostname, path, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'blockchain-com',
  name: 'Blockchain.com',
  category: 'blockchain',
  icon: 'Link',
  description: 'Query Bitcoin blockchain data — addresses, transactions, blocks, and exchange rates.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await bcReq('blockchain.info', '/latestblock'); return { success: true, message: `Latest block: ${r.height}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_address: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return bcReq('blockchain.info', `/rawaddr/${params.address}?limit=${params.limit || 10}`);
    },
    get_transaction: async (params, creds) => {
      if (!params.txid) throw new Error('txid required');
      return bcReq('blockchain.info', `/rawtx/${params.txid}`);
    },
    get_block: async (params, creds) => {
      if (!params.block_hash) throw new Error('block_hash required');
      return bcReq('blockchain.info', `/rawblock/${params.block_hash}`);
    },
    get_exchange_rates: async (params, creds) => {
      return bcReq('blockchain.info', '/ticker');
    },
    get_unspent_outputs: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return bcReq('blockchain.info', `/unspent?active=${params.address}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
