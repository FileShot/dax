/**
 * 1Password Connect API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function opApi(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `/v1${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: '1password',
  name: '1Password',
  category: 'security',
  icon: 'Lock',
  description: 'Access vaults and items via 1Password Connect Server.',
  configFields: [
    { key: 'base_url', label: 'Connect Server URL', type: 'text', required: true, placeholder: 'http://localhost:8080' },
    { key: 'token', label: 'Connect Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.base_url || !creds.token) throw new Error('Server URL and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await opApi('GET', creds.base_url, '/vaults', creds.token); return { success: Array.isArray(r), message: Array.isArray(r) ? `${r.length} vault(s) found` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_vaults: async (params, creds) => opApi('GET', creds.base_url, '/vaults', creds.token),
    list_items: async (params, creds) => { if (!params.vault_id) throw new Error('vault_id required'); return opApi('GET', creds.base_url, `/vaults/${params.vault_id}/items`, creds.token); },
    get_item: async (params, creds) => { if (!params.vault_id || !params.item_id) throw new Error('vault_id and item_id required'); return opApi('GET', creds.base_url, `/vaults/${params.vault_id}/items/${params.item_id}`, creds.token); },
    create_item: async (params, creds) => { if (!params.vault_id || !params.item) throw new Error('vault_id and item required'); return opApi('POST', creds.base_url, `/vaults/${params.vault_id}/items`, creds.token, params.item); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
