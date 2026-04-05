/**
 * Solana JSON-RPC Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function solReq(method, rpcParams, creds) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: rpcParams });
  const endpoint = (creds && creds.rpc_url) ? creds.rpc_url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'api.mainnet-beta.solana.com';
  return makeRequest({ method: 'POST', hostname: endpoint, path: '/', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body);
}

module.exports = {
  id: 'solana-rpc',
  name: 'Solana RPC',
  category: 'blockchain',
  icon: 'Zap',
  description: 'Query the Solana blockchain via JSON-RPC — balances, transactions, tokens, and blocks.',
  configFields: [
    { key: 'rpc_url', label: 'RPC URL (default: mainnet-beta)', type: 'text', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await solReq('getSlot', [], creds); return { success: true, message: `Current slot: ${r.result}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_balance: async (params, creds) => {
      if (!params.pubkey) throw new Error('pubkey required');
      return solReq('getBalance', [params.pubkey], creds);
    },
    get_transaction: async (params, creds) => {
      if (!params.signature) throw new Error('signature required');
      return solReq('getTransaction', [params.signature, { encoding: 'json', maxSupportedTransactionVersion: 0 }], creds);
    },
    get_token_accounts: async (params, creds) => {
      if (!params.pubkey) throw new Error('pubkey required');
      return solReq('getTokenAccountsByOwner', [params.pubkey, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }], creds);
    },
    get_slot: async (params, creds) => {
      return solReq('getSlot', [], creds);
    },
    get_block: async (params, creds) => {
      if (!params.slot) throw new Error('slot required');
      return solReq('getBlock', [Number(params.slot), { encoding: 'json', maxSupportedTransactionVersion: 0, transactionDetails: 'signatures' }], creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
