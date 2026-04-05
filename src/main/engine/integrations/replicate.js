/**
 * Replicate API Integration
 */
'use strict';
const https = require('https');

function repApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.replicate.com', path: `/v1${path}`, headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'replicate',
  name: 'Replicate',
  category: 'ai-ml',
  icon: 'RefreshCw',
  description: 'Run machine learning models in the cloud via Replicate.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await repApi('GET', '/account', creds.api_token); return { success: !!r.username, message: `Connected as ${r.username}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    create_prediction: async (params, creds) => {
      if (!params.version || !params.input) throw new Error('version and input required');
      const body = { version: params.version, input: params.input };
      if (params.webhook) body.webhook = params.webhook;
      return repApi('POST', '/predictions', creds.api_token, body);
    },
    get_prediction: async (params, creds) => { if (!params.prediction_id) throw new Error('prediction_id required'); return repApi('GET', `/predictions/${params.prediction_id}`, creds.api_token); },
    cancel_prediction: async (params, creds) => { if (!params.prediction_id) throw new Error('prediction_id required'); return repApi('POST', `/predictions/${params.prediction_id}/cancel`, creds.api_token); },
    list_predictions: async (params, creds) => repApi('GET', '/predictions', creds.api_token),
    list_models: async (params, creds) => {
      const qs = params.cursor ? `?cursor=${params.cursor}` : '';
      return repApi('GET', `/models${qs}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
