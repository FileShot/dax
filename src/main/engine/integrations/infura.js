/**
 * Infura Ethereum/IPFS API Integration (JSON-RPC)
 */
'use strict';
const https = require('https');

function infuraRpc(method, params, projectId, network) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method, params: params || [], id: 1 });
    const hostname = `${network || 'mainnet'}.infura.io`;
    const opts = { method: 'POST', hostname, path: `/v3/${projectId}`, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
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

module.exports = {
  id: 'infura',
  name: 'Infura',
  category: 'blockchain',
  icon: 'Cpu',
  description: 'Access Ethereum and IPFS nodes via Infura JSON-RPC API.',
  configFields: [
    { key: 'project_id', label: 'Project ID', type: 'text', required: true },
    { key: 'network', label: 'Network (e.g. mainnet, goerli)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.project_id) throw new Error('Project ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await infuraRpc('eth_blockNumber', [], creds.project_id, creds.network); return { success: !!r.result, message: r.error?.message || `Connected — block ${parseInt(r.result, 16)}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    eth_get_balance: async (params, creds) => {
      if (!params.address) throw new Error('address required');
      return infuraRpc('eth_getBalance', [params.address, params.block || 'latest'], creds.project_id, creds.network);
    },
    eth_get_block: async (params, creds) => {
      const tag = params.block_number ? `0x${parseInt(params.block_number).toString(16)}` : (params.block_tag || 'latest');
      return infuraRpc('eth_getBlockByNumber', [tag, params.full_transactions || false], creds.project_id, creds.network);
    },
    eth_get_transaction: async (params, creds) => {
      if (!params.tx_hash) throw new Error('tx_hash required');
      return infuraRpc('eth_getTransactionByHash', [params.tx_hash], creds.project_id, creds.network);
    },
    eth_call: async (params, creds) => {
      if (!params.to) throw new Error('to address required');
      return infuraRpc('eth_call', [{ to: params.to, data: params.data || '0x', ...(params.from && { from: params.from }) }, params.block || 'latest'], creds.project_id, creds.network);
    },
    eth_block_number: async (params, creds) => {
      return infuraRpc('eth_blockNumber', [], creds.project_id, creds.network);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
