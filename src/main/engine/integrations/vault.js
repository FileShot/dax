/**
 * HashiCorp Vault API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function vaultApi(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 8200), path: `/v1${path}`, headers: { 'X-Vault-Token': token, 'Content-Type': 'application/json' } };
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
  id: 'vault',
  name: 'HashiCorp Vault',
  category: 'security',
  icon: 'Shield',
  description: 'Manage secrets and encryption with HashiCorp Vault.',
  configFields: [
    { key: 'base_url', label: 'Vault URL', type: 'text', required: true, placeholder: 'http://localhost:8200' },
    { key: 'token', label: 'Vault Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.base_url || !creds.token) throw new Error('Vault URL and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await vaultApi('GET', creds.base_url, '/sys/health', creds.token); return { success: !!r.initialized, message: r.initialized ? `Vault v${r.version}` : 'Not initialized' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    read_secret: async (params, creds) => { if (!params.path) throw new Error('path required'); return vaultApi('GET', creds.base_url, `/${params.mount || 'secret'}/data/${params.path}`, creds.token); },
    write_secret: async (params, creds) => { if (!params.path || !params.data) throw new Error('path and data required'); return vaultApi('POST', creds.base_url, `/${params.mount || 'secret'}/data/${params.path}`, creds.token, { data: params.data }); },
    delete_secret: async (params, creds) => { if (!params.path) throw new Error('path required'); return vaultApi('DELETE', creds.base_url, `/${params.mount || 'secret'}/data/${params.path}`, creds.token); },
    list_secrets: async (params, creds) => vaultApi('LIST', creds.base_url, `/${params.mount || 'secret'}/metadata/${params.path || ''}`, creds.token),
    get_health: async (params, creds) => vaultApi('GET', creds.base_url, '/sys/health', creds.token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
