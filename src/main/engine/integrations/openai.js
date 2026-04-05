/**
 * OpenAI API Integration
 */
'use strict';
const https = require('https');

function openaiApi(method, path, apiKey, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.openai.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...extraHeaders } };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('Timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'openai',
  name: 'OpenAI',
  category: 'ai',
  icon: 'Brain',
  description: 'Access OpenAI GPT, DALL-E, embeddings, and moderation APIs.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'org_id', label: 'Organization ID (optional)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await openaiApi('GET', '/models', creds.api_key); return { success: !!r.data, message: r.data ? `Connected (${r.data.length} models)` : `Error: ${r.error?.message}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    chat: async (params, creds) => {
      if (!params.messages && !params.prompt) throw new Error('messages array or prompt required');
      const messages = params.messages || [{ role: 'user', content: params.prompt }];
      const body = { model: params.model || 'gpt-4o-mini', messages, temperature: params.temperature ?? 0.7, max_tokens: params.max_tokens || 1024 };
      if (params.system) messages.unshift({ role: 'system', content: params.system });
      const r = await openaiApi('POST', '/chat/completions', creds.api_key, body);
      if (r.error) throw new Error(r.error.message);
      return { content: r.choices?.[0]?.message?.content, usage: r.usage, model: r.model, id: r.id };
    },
    embed: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      const r = await openaiApi('POST', '/embeddings', creds.api_key, { model: params.model || 'text-embedding-3-small', input: params.input });
      if (r.error) throw new Error(r.error.message);
      return { embeddings: r.data?.map((d) => d.embedding), usage: r.usage };
    },
    image: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      const r = await openaiApi('POST', '/images/generations', creds.api_key, { model: params.model || 'dall-e-3', prompt: params.prompt, n: params.n || 1, size: params.size || '1024x1024', response_format: params.format || 'url' });
      if (r.error) throw new Error(r.error.message);
      return { images: r.data?.map((d) => ({ url: d.url, revised_prompt: d.revised_prompt })) };
    },
    moderate: async (params, creds) => {
      if (!params.input) throw new Error('input required');
      const r = await openaiApi('POST', '/moderations', creds.api_key, { input: params.input });
      return r.results?.[0];
    },
    list_models: async (params, creds) => {
      const r = await openaiApi('GET', '/models', creds.api_key);
      return r.data?.map((m) => ({ id: m.id, created: m.created, owned_by: m.owned_by }));
    },

    list_files: async (params, creds) => {
      const r = await openaiApi('GET', '/files', creds.api_key);
      if (r.error) throw new Error(r.error.message);
      return (r.data || []).map((f) => ({ id: f.id, filename: f.filename, purpose: f.purpose, size: f.bytes, created: f.created_at }));
    },

    create_fine_tune: async (params, creds) => {
      if (!params.training_file) throw new Error('training_file (file ID) required');
      const body = { training_file: params.training_file, model: params.model || 'gpt-3.5-turbo' };
      if (params.validation_file) body.validation_file = params.validation_file;
      if (params.suffix) body.suffix = params.suffix;
      const r = await openaiApi('POST', '/fine_tuning/jobs', creds.api_key, body);
      if (r.error) throw new Error(r.error.message);
      return { id: r.id, status: r.status, model: r.model, created: r.created_at };
    },

    list_fine_tunes: async (params, creds) => {
      const r = await openaiApi('GET', `/fine_tuning/jobs?limit=${params.limit || 10}`, creds.api_key);
      if (r.error) throw new Error(r.error.message);
      return (r.data || []).map((j) => ({ id: j.id, status: j.status, model: j.model, fine_tuned_model: j.fine_tuned_model, created: j.created_at }));
    },

    create_assistant: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const body = { model: params.model || 'gpt-4o-mini', name: params.name };
      if (params.instructions) body.instructions = params.instructions;
      if (params.tools) body.tools = params.tools;
      if (params.description) body.description = params.description;
      const r = await openaiApi('POST', '/assistants', creds.api_key, body, { 'OpenAI-Beta': 'assistants=v2' });
      if (r.error) throw new Error(r.error.message);
      return { id: r.id, name: r.name, model: r.model, created: r.created_at };
    },

    list_assistants: async (params, creds) => {
      const r = await openaiApi('GET', `/assistants?limit=${params.limit || 20}&order=desc`, creds.api_key, null, { 'OpenAI-Beta': 'assistants=v2' });
      if (r.error) throw new Error(r.error.message);
      return (r.data || []).map((a) => ({ id: a.id, name: a.name, model: a.model, created: a.created_at }));
    },

    analyze_image: async (params, creds) => {
      if (!params.image_url && !params.prompt) throw new Error('image_url and prompt required');
      const messages = [{
        role: 'user', content: [
          { type: 'text', text: params.prompt || 'Describe this image.' },
          { type: 'image_url', image_url: { url: params.image_url, detail: params.detail || 'auto' } },
        ],
      }];
      const r = await openaiApi('POST', '/chat/completions', creds.api_key, { model: params.model || 'gpt-4o-mini', messages });
      if (r.error) throw new Error(r.error.message);
      return { content: r.choices?.[0]?.message?.content, usage: r.usage };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
