/**
 * Cloudflare API Integration
 */
'use strict';
const https = require('https');

function cfApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.cloudflare.com', path: `/client/v4${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
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
  id: 'cloudflare',
  name: 'Cloudflare',
  category: 'devops',
  icon: 'Shield',
  description: 'Manage Cloudflare zones, DNS records, and Workers.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await cfApi('GET', '/user/tokens/verify', creds.api_token); return { success: r.success, message: r.success ? 'Token valid' : `Error: ${r.errors?.[0]?.message}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_zones: async (params, creds) => {
      const limit = params.limit || 20;
      return cfApi('GET', `/zones?per_page=${limit}`, creds.api_token);
    },
    get_zone: async (params, creds) => { if (!params.zone_id) throw new Error('zone_id required'); return cfApi('GET', `/zones/${params.zone_id}`, creds.api_token); },
    list_dns_records: async (params, creds) => {
      if (!params.zone_id) throw new Error('zone_id required');
      let path = `/zones/${params.zone_id}/dns_records?per_page=${params.limit || 50}`;
      if (params.type) path += `&type=${params.type}`;
      if (params.name) path += `&name=${params.name}`;
      return cfApi('GET', path, creds.api_token);
    },
    create_dns_record: async (params, creds) => {
      if (!params.zone_id || !params.type || !params.name || !params.content) throw new Error('zone_id, type, name, and content required');
      const body = { type: params.type, name: params.name, content: params.content, ttl: params.ttl || 1, proxied: params.proxied !== false };
      return cfApi('POST', `/zones/${params.zone_id}/dns_records`, creds.api_token, body);
    },
    update_dns_record: async (params, creds) => {
      if (!params.zone_id || !params.record_id) throw new Error('zone_id and record_id required');
      const body = {};
      if (params.type) body.type = params.type;
      if (params.name) body.name = params.name;
      if (params.content) body.content = params.content;
      if (params.ttl) body.ttl = params.ttl;
      if (params.proxied !== undefined) body.proxied = params.proxied;
      return cfApi('PATCH', `/zones/${params.zone_id}/dns_records/${params.record_id}`, creds.api_token, body);
    },
    delete_dns_record: async (params, creds) => {
      if (!params.zone_id || !params.record_id) throw new Error('zone_id and record_id required');
      return cfApi('DELETE', `/zones/${params.zone_id}/dns_records/${params.record_id}`, creds.api_token);
    },
    purge_cache: async (params, creds) => {
      if (!params.zone_id) throw new Error('zone_id required');
      const body = params.files ? { files: params.files } : { purge_everything: true };
      return cfApi('POST', `/zones/${params.zone_id}/purge_cache`, creds.api_token, body);
    },
    list_workers: async (params, creds) => cfApi('GET', '/accounts/' + (params.account_id || '') + '/workers/scripts', creds.api_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
