/**
 * Rev.ai Speech-to-Text API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function revReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.rev.ai', path: `/speechtotext/v1${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'revai',
  name: 'Rev.ai',
  category: 'ai',
  icon: 'Mic',
  description: 'Submit audio/video jobs, get transcripts and captions with Rev.ai speech recognition.',
  configFields: [{ key: 'access_token', label: 'Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await revReq('GET', '/jobs?limit=1', null, creds); return { success: true, message: `Connected — ${r.jobs?.length ?? 0} recent job(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    submit_job: async (params, creds) => {
      if (!params.media_url && !params.source_config) throw new Error('media_url required');
      return revReq('POST', '/jobs', { media_url: params.media_url, metadata: params.metadata, skip_diarization: params.skip_diarization || false, language: params.language || 'en', transcriber: params.transcriber || 'machine' }, creds);
    },
    get_job: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return revReq('GET', `/jobs/${params.id}`, null, creds);
    },
    list_jobs: async (params, creds) => revReq('GET', `/jobs?limit=${params.limit || 20}${params.starting_after ? `&starting_after=${params.starting_after}` : ''}`, null, creds),
    get_transcript: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return revReq('GET', `/jobs/${params.id}/transcript`, null, creds);
    },
    get_captions: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      const fmt = params.format || 'srt'; // srt, vtt, etc.
      const opts = { method: 'GET', hostname: 'api.rev.ai', path: `/speechtotext/v1/jobs/${params.id}/captions?speaker_channel=${params.speaker_channel || 0}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': `text/x-rev-ai-captions-${fmt}` } };
      return makeRequest(opts, null);
    },
    delete_job: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return revReq('DELETE', `/jobs/${params.id}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
