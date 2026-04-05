/**
 * Infermedica Symptom Checker API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function infReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'api.infermedica.com', path, headers: { 'App-Id': creds.app_id, 'App-Key': creds.app_key, 'Content-Type': 'application/json', 'Accept': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'infermedica',
  name: 'Infermedica',
  category: 'health',
  icon: 'Stethoscope',
  description: 'Clinical decision support — symptom checking, triage, and diagnoses via the Infermedica API.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
    { key: 'app_key', label: 'App Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.app_key) throw new Error('app_id and app_key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await infReq('GET', '/v3/info', null, creds); return { success: true, message: `Infermedica: ${r.conditions_count} conditions, ${r.symptoms_count} symptoms` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    parse: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      return infReq('POST', '/v3/parse', { text: params.text, age: params.age || { value: 30 } }, creds);
    },
    diagnose: async (params, creds) => {
      if (!params.evidence || !params.sex || !params.age) throw new Error('evidence, sex, and age required');
      return infReq('POST', '/v3/diagnosis', { evidence: params.evidence, sex: params.sex, age: params.age }, creds);
    },
    triage: async (params, creds) => {
      if (!params.evidence || !params.sex || !params.age) throw new Error('evidence, sex, and age required');
      return infReq('POST', '/v3/triage', { evidence: params.evidence, sex: params.sex, age: params.age }, creds);
    },
    suggest: async (params, creds) => {
      if (!params.evidence || !params.sex || !params.age) throw new Error('evidence, sex, and age required');
      return infReq('POST', '/v3/suggest', { evidence: params.evidence, sex: params.sex, age: params.age }, creds);
    },
    search_symptoms: async (params, creds) => {
      if (!params.phrase) throw new Error('phrase required');
      return infReq('GET', `/v3/symptoms?phrase=${encodeURIComponent(params.phrase)}&sex=${params.sex || 'male'}&age.value=${params.age || 30}`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
