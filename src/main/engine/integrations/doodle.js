/**
 * Doodle Scheduling API Integration
 */
'use strict';
const https = require('https');

function doodleApi(method, path, apiKey, apiSecret, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const opts = { method, hostname: 'api.doodle.com', path, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'doodle',
  name: 'Doodle',
  category: 'scheduling',
  icon: 'CheckSquare',
  description: 'Create and manage Doodle polls for group scheduling.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'text', required: true },
    { key: 'api_secret', label: 'API Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.api_secret) throw new Error('API key and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { return { success: !!(creds.api_key && creds.api_secret), message: 'Credentials configured' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_poll: async (params, creds) => { if (!params.poll_id) throw new Error('poll_id required'); return doodleApi('GET', `/api/v2.0/polls/${params.poll_id}`, creds.api_key, creds.api_secret); },
    create_poll: async (params, creds) => {
      if (!params.title || !params.options) throw new Error('title and options required');
      return doodleApi('POST', '/api/v2.0/polls', creds.api_key, creds.api_secret, { title: params.title, description: params.description || '', type: params.type || 'TEXT', options: params.options });
    },
    delete_poll: async (params, creds) => { if (!params.poll_id) throw new Error('poll_id required'); return doodleApi('DELETE', `/api/v2.0/polls/${params.poll_id}`, creds.api_key, creds.api_secret); },
    add_participant: async (params, creds) => {
      if (!params.poll_id || !params.name || !params.preferences) throw new Error('poll_id, name, and preferences required');
      return doodleApi('POST', `/api/v2.0/polls/${params.poll_id}/participants`, creds.api_key, creds.api_secret, { name: params.name, preferences: params.preferences });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
