/**
 * Home Assistant REST API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function haApi(method, baseUrl, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: `/api${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    if (url.protocol === 'https:') opts.rejectUnauthorized = false;
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
  id: 'home-assistant',
  name: 'Home Assistant',
  category: 'iot',
  icon: 'Home',
  description: 'Control smart home devices and automations via Home Assistant.',
  configFields: [
    { key: 'base_url', label: 'Home Assistant URL', type: 'text', required: true, placeholder: 'http://homeassistant.local:8123' },
    { key: 'access_token', label: 'Long-Lived Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.base_url || !creds.access_token) throw new Error('URL and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await haApi('GET', creds.base_url, '/', creds.access_token); return { success: !!r.message, message: r.message || 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_states: async (params, creds) => haApi('GET', creds.base_url, '/states', creds.access_token),
    get_entity_state: async (params, creds) => { if (!params.entity_id) throw new Error('entity_id required'); return haApi('GET', creds.base_url, `/states/${params.entity_id}`, creds.access_token); },
    call_service: async (params, creds) => {
      if (!params.domain || !params.service) throw new Error('domain and service required');
      return haApi('POST', creds.base_url, `/services/${params.domain}/${params.service}`, creds.access_token, params.data || {});
    },
    fire_event: async (params, creds) => {
      if (!params.event_type) throw new Error('event_type required');
      return haApi('POST', creds.base_url, `/events/${params.event_type}`, creds.access_token, params.data || {});
    },
    list_services: async (params, creds) => haApi('GET', creds.base_url, '/services', creds.access_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
