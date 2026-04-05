/**
 * RxNorm Drug Normalization API Integration (NLM/NIH — free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function rxReq(path) {
  return makeRequest({ method: 'GET', hostname: 'rxnav.nlm.nih.gov', path: `/REST${path}`, headers: { 'Accept': 'application/json' } }, null);
}

module.exports = {
  id: 'rxnorm',
  name: 'RxNorm',
  category: 'health',
  icon: 'Pill',
  description: 'Look up drug names, RxCUIs, interactions, and NDC codes via the NLM RxNorm API.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await rxReq('/drugs.json?name=ibuprofen'); return { success: true, message: 'RxNorm API reachable' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    find_drugs: async (params, creds) => {
      if (!params.name) throw new Error('drug name required');
      return rxReq(`/drugs.json?name=${encodeURIComponent(params.name)}`);
    },
    get_rxcui: async (params, creds) => {
      if (!params.name) throw new Error('drug name required');
      return rxReq(`/rxcui.json?name=${encodeURIComponent(params.name)}`);
    },
    get_properties: async (params, creds) => {
      if (!params.rxcui) throw new Error('rxcui required');
      return rxReq(`/rxcui/${params.rxcui}/properties.json`);
    },
    get_interactions: async (params, creds) => {
      if (!params.rxcui) throw new Error('rxcui required');
      return rxReq(`/interaction/interaction.json?rxcui=${params.rxcui}`);
    },
    find_ndc: async (params, creds) => {
      if (!params.rxcui) throw new Error('rxcui required');
      return rxReq(`/rxcui/${params.rxcui}/ndcs.json`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
