/**
 * Apify Web Scraping & Automation API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function apifyReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.apify.com', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${creds.api_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'apify',
  name: 'Apify',
  category: 'data',
  icon: 'Globe',
  description: 'Run actors, retrieve datasets, and manage web scraping workflows with Apify.',
  configFields: [{ key: 'api_token', label: 'API Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.api_token) throw new Error('api_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await apifyReq('GET', '/acts?limit=1', null, creds); return { success: true, message: `Connected — ${r.data?.total ?? 0} actor(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_actors: async (params, creds) => apifyReq('GET', `/acts?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
    get_actor: async (params, creds) => {
      if (!params.actor_id) throw new Error('actor_id required');
      return apifyReq('GET', `/acts/${params.actor_id}`, null, creds);
    },
    run_actor: async (params, creds) => {
      if (!params.actor_id) throw new Error('actor_id required');
      return apifyReq('POST', `/acts/${params.actor_id}/runs`, params.input || {}, creds);
    },
    get_run: async (params, creds) => {
      if (!params.run_id) throw new Error('run_id required');
      return apifyReq('GET', `/actor-runs/${params.run_id}`, null, creds);
    },
    get_dataset_items: async (params, creds) => {
      if (!params.dataset_id) throw new Error('dataset_id required');
      return apifyReq('GET', `/datasets/${params.dataset_id}/items?limit=${params.limit || 100}&offset=${params.offset || 0}&format=json`, null, creds);
    },
    list_datasets: async (params, creds) => apifyReq('GET', `/datasets?limit=${params.limit || 20}&offset=${params.offset || 0}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
