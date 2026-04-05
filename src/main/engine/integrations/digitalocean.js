/**
 * DigitalOcean API Integration
 */
'use strict';
const https = require('https');

function doApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.digitalocean.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode === 204) return resolve({ success: true });
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'digitalocean',
  name: 'DigitalOcean',
  category: 'devops',
  icon: 'Server',
  description: 'Manage DigitalOcean droplets, databases, and domains.',
  configFields: [
    { key: 'api_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await doApi('GET', '/account', creds.api_token); return { success: !!r.account?.uuid, message: r.account?.uuid ? `Connected (${r.account.email})` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_droplets: async (params, creds) => doApi('GET', `/droplets?per_page=${params.limit || 20}`, creds.api_token),
    get_droplet: async (params, creds) => { if (!params.droplet_id) throw new Error('droplet_id required'); return doApi('GET', `/droplets/${params.droplet_id}`, creds.api_token); },
    droplet_action: async (params, creds) => {
      if (!params.droplet_id || !params.action_type) throw new Error('droplet_id and action_type required');
      return doApi('POST', `/droplets/${params.droplet_id}/actions`, creds.api_token, { type: params.action_type });
    },
    list_databases: async (params, creds) => doApi('GET', '/databases', creds.api_token),
    list_domains: async (params, creds) => doApi('GET', '/domains', creds.api_token),
    list_dns_records: async (params, creds) => {
      if (!params.domain) throw new Error('domain required');
      return doApi('GET', `/domains/${params.domain}/records?per_page=${params.limit || 50}`, creds.api_token);
    },
    create_dns_record: async (params, creds) => {
      if (!params.domain || !params.type || !params.name || !params.data) throw new Error('domain, type, name, and data required');
      return doApi('POST', `/domains/${params.domain}/records`, creds.api_token, { type: params.type, name: params.name, data: params.data, ttl: params.ttl || 3600 });
    },
    list_apps: async (params, creds) => doApi('GET', '/apps', creds.api_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
