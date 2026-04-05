/**
 * Hugging Face Inference API Integration
 */
'use strict';
const https = require('https');

function hfApi(model, token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const opts = { method: 'POST', hostname: 'api-inference.huggingface.co', path: `/models/${model}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function hfApiGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'huggingface.co', path, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'huggingface',
  name: 'Hugging Face',
  category: 'ai-ml',
  icon: 'Cpu',
  description: 'Run inference on thousands of models via Hugging Face API.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hfApiGet('/api/whoami-v2', creds.api_token); return { success: !!r.name, message: `Connected as ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    text_generation: async (params, creds) => {
      if (!params.model || !params.inputs) throw new Error('model and inputs required');
      return hfApi(params.model, creds.api_token, { inputs: params.inputs, parameters: { max_new_tokens: params.max_new_tokens || 200, temperature: params.temperature || 0.7 } });
    },
    text_classification: async (params, creds) => {
      if (!params.model || !params.inputs) throw new Error('model and inputs required');
      return hfApi(params.model, creds.api_token, { inputs: params.inputs });
    },
    image_classification: async (params, creds) => {
      if (!params.model || !params.image_url) throw new Error('model and image_url required');
      return hfApi(params.model, creds.api_token, { inputs: params.image_url });
    },
    embeddings: async (params, creds) => {
      if (!params.model || !params.inputs) throw new Error('model and inputs required');
      return hfApi(params.model, creds.api_token, { inputs: params.inputs });
    },
    list_models: async (params, creds) => {
      const qs = new URLSearchParams({ limit: params.limit || 20 });
      if (params.task) qs.set('pipeline_tag', params.task);
      if (params.search) qs.set('search', params.search);
      return hfApiGet(`/api/models?${qs}`, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
