/**
 * Dolby.io Media Processing API Integration
 */
'use strict';
const { makeRequest, TokenCache } = require('../../engine/integration-utils');

const _cache = new TokenCache();

async function getDolbyToken(creds) {
  return _cache.get(`dolby:${creds.app_key}`, async () => {
    const body = 'grant_type=client_credentials';
    const auth = Buffer.from(`${creds.app_key}:${creds.app_secret}`).toString('base64');
    const opts = { method: 'POST', hostname: 'api.dolby.io', path: '/auth/v1/token', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const r = await makeRequest(opts, body);
    return { token: r.access_token, expiresAt: Date.now() + (r.expires_in - 60) * 1000 };
  });
}

async function dolbyReq(apiHost, method, path, body, creds) {
  const token = await getDolbyToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: apiHost, path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'dolby-io',
  name: 'Dolby.io',
  category: 'video',
  icon: 'Music',
  description: 'Enhance, transcode, analyze, and transcribe media files with Dolby.io.',
  configFields: [
    { key: 'app_key', label: 'App Key', type: 'string', required: true },
    { key: 'app_secret', label: 'App Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_key || !creds.app_secret) throw new Error('app_key and app_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getDolbyToken(creds); return { success: true, message: 'Connected to Dolby.io' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    enhance_media: async (params, creds) => {
      if (!params.input_url || !params.output_url) throw new Error('input_url and output_url required');
      return dolbyReq('api.dolby.io', 'POST', '/media/enhance', { input: params.input_url, output: params.output_url, content: { type: params.content_type || 'podcast' } }, creds);
    },
    get_enhance_job: async (params, creds) => {
      if (!params.job_id) throw new Error('job_id required');
      return dolbyReq('api.dolby.io', 'GET', `/media/enhance?job_id=${params.job_id}`, null, creds);
    },
    transcode_media: async (params, creds) => {
      if (!params.input_url || !params.output_url) throw new Error('input_url and output_url required');
      return dolbyReq('api.dolby.io', 'POST', '/media/transcode', { inputs: [{ source: params.input_url }], outputs: [{ destination: params.output_url }] }, creds);
    },
    analyze_media: async (params, creds) => {
      if (!params.input_url) throw new Error('input_url required');
      return dolbyReq('api.dolby.io', 'POST', '/media/analyze', { input: params.input_url }, creds);
    },
    diagnose_media: async (params, creds) => {
      if (!params.input_url) throw new Error('input_url required');
      return dolbyReq('api.dolby.io', 'POST', '/media/diagnose', { input: params.input_url }, creds);
    },
    get_job_progress: async (params, creds) => {
      if (!params.job_id || !params.api_path) throw new Error('job_id and api_path required (e.g. /media/enhance)');
      return dolbyReq('api.dolby.io', 'GET', `${params.api_path}?job_id=${params.job_id}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
