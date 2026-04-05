/**
 * Stability AI API Integration
 */
'use strict';
const https = require('https');

function stabRequest(method, path, apiKey, body = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const opts = {
      method, hostname: 'api.stability.ai', path,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': contentType, 'Accept': 'application/json' },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'stability-ai',
  name: 'Stability AI',
  category: 'ai-ml',
  icon: 'Sparkles',
  description: 'Generate and transform images using Stability AI (Stable Diffusion).',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await stabRequest('GET', '/v1/user/account', creds.api_key); return { success: !!r.id, message: `Connected as ${r.profile_picture ? 'user' : 'account'}, ${r.credits || 0} credits` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    text_to_image: async (params, creds) => {
      if (!params.prompt) throw new Error('prompt required');
      const engine = params.engine || 'stable-diffusion-v1-6';
      return stabRequest('POST', `/v1/generation/${engine}/text-to-image`, creds.api_key, { text_prompts: [{ text: params.prompt, weight: 1 }], cfg_scale: params.cfg_scale || 7, height: params.height || 512, width: params.width || 512, samples: params.samples || 1, steps: params.steps || 30 });
    },
    list_engines: async (params, creds) => stabRequest('GET', '/v1/engines/list', creds.api_key),
    get_balance: async (params, creds) => stabRequest('GET', '/v1/user/balance', creds.api_key),
    image_to_image: async (params, creds) => {
      if (!params.prompt || !params.init_image_base64) throw new Error('prompt and init_image_base64 required');
      const engine = params.engine || 'stable-diffusion-v1-6';
      return stabRequest('POST', `/v1/generation/${engine}/image-to-image`, creds.api_key, { text_prompts: [{ text: params.prompt, weight: 1 }], init_image: params.init_image_base64, image_strength: params.image_strength || 0.35, steps: params.steps || 30 });
    },
    upscale: async (params, creds) => {
      if (!params.image_base64) throw new Error('image_base64 required');
      return stabRequest('POST', '/v1/generation/esrgan-v1-x2plus/image-to-image/upscale', creds.api_key, { image: params.image_base64, width: params.width || 1024 });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
