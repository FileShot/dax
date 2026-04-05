/**
 * FHIR R4 Healthcare Data Integration
 */
'use strict';
const https = require('https');
const http = require('http');
const url = require('url');

function fhirGet(baseUrl, path, accessToken) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(baseUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const fullPath = `${parsed.pathname?.replace(/\/$/, '')}${path}`;
    const opts = { method: 'GET', hostname: parsed.hostname, port: parsed.port || (isHttps ? 443 : 80), path: fullPath, headers: { 'Accept': 'application/fhir+json', ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }) } };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'fhir',
  name: 'FHIR R4',
  category: 'health',
  icon: 'FileHeart',
  description: 'Interact with any FHIR R4 compliant healthcare data server (EHR, HIE, public datasets).',
  configFields: [
    { key: 'base_url', label: 'FHIR Base URL', type: 'text', required: true, placeholder: 'https://server.fire.ly/r4' },
    { key: 'access_token', label: 'Bearer Token (optional)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.base_url) throw new Error('FHIR base URL required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await fhirGet(creds.base_url, '/metadata', creds.access_token); if (r.resourceType === 'CapabilityStatement') return { success: true, message: `FHIR ${r.fhirVersion || 'R4'} server connected` }; if (r.resourceType === 'OperationOutcome') return { success: false, message: r.issue?.[0]?.diagnostics || 'FHIR error' }; return { success: true, message: 'Connected to FHIR server' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_patient: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return fhirGet(creds.base_url, `/Patient/${params.id}`, creds.access_token);
    },
    search_observations: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.patient && { patient: params.patient }), ...(params.code && { code: params.code }), ...(params.date && { date: params.date }), _count: String(params._count || 20) }).toString();
      return fhirGet(creds.base_url, `/Observation?${qs}`, creds.access_token);
    },
    get_medication: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return fhirGet(creds.base_url, `/Medication/${params.id}`, creds.access_token);
    },
    search_conditions: async (params, creds) => {
      const qs = new URLSearchParams({ ...(params.patient && { patient: params.patient }), ...(params.code && { code: params.code }), _count: String(params._count || 20) }).toString();
      return fhirGet(creds.base_url, `/Condition?${qs}`, creds.access_token);
    },
    get_encounter: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return fhirGet(creds.base_url, `/Encounter/${params.id}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
