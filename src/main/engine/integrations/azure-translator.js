/**
 * Azure Cognitive Services Translator Integration
 */
'use strict';
const https = require('https');

function azureTranslatorRequest(method, path, body, subscriptionKey, region) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Ocp-Apim-Subscription-Key': subscriptionKey, 'Content-Type': 'application/json', ...(region && { 'Ocp-Apim-Subscription-Region': region }), ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) };
    const opts = { method, hostname: 'api.cognitive.microsofttranslator.com', path, headers };
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
  id: 'azure-translator',
  name: 'Azure Translator',
  category: 'translation',
  icon: 'FileText',
  description: 'Translate text, detect languages, and transliterate using Azure Cognitive Services Translator.',
  configFields: [
    { key: 'subscription_key', label: 'Subscription Key', type: 'password', required: true },
    { key: 'region', label: 'Region (e.g. eastus)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.subscription_key) throw new Error('Subscription key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await azureTranslatorRequest('GET', '/languages?api-version=3.0&scope=translation', null, creds.subscription_key, creds.region); return { success: !!r.translation, message: r.error ? r.error.message : 'Connected to Azure Translator' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    translate: async (params, creds) => {
      if (!params.text || !params.to) throw new Error('text and to (target language) required');
      const texts = Array.isArray(params.text) ? params.text.map(t => ({ text: t })) : [{ text: params.text }];
      const qs = new URLSearchParams({ 'api-version': '3.0', to: Array.isArray(params.to) ? params.to.join(',') : params.to, ...(params.from && { from: params.from }), ...(params.textType && { textType: params.textType }), ...(params.category && { category: params.category }) }).toString();
      return azureTranslatorRequest('POST', `/translate?${qs}`, texts, creds.subscription_key, creds.region);
    },
    detect: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const body = Array.isArray(params.text) ? params.text.map(t => ({ text: t })) : [{ text: params.text }];
      return azureTranslatorRequest('POST', '/detect?api-version=3.0', body, creds.subscription_key, creds.region);
    },
    transliterate: async (params, creds) => {
      if (!params.text || !params.language || !params.fromScript || !params.toScript) throw new Error('text, language, fromScript, and toScript required');
      const qs = new URLSearchParams({ 'api-version': '3.0', language: params.language, fromScript: params.fromScript, toScript: params.toScript }).toString();
      const body = Array.isArray(params.text) ? params.text.map(t => ({ text: t })) : [{ text: params.text }];
      return azureTranslatorRequest('POST', `/transliterate?${qs}`, body, creds.subscription_key, creds.region);
    },
    list_languages: async (params, creds) => {
      const scope = params.scope || 'translation,detection,transliteration';
      return azureTranslatorRequest('GET', `/languages?api-version=3.0&scope=${encodeURIComponent(scope)}`, null, creds.subscription_key, creds.region);
    },
    break_sentence: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const qs = new URLSearchParams({ 'api-version': '3.0', ...(params.language && { language: params.language }) }).toString();
      const body = Array.isArray(params.text) ? params.text.map(t => ({ text: t })) : [{ text: params.text }];
      return azureTranslatorRequest('POST', `/breaksentence?${qs}`, body, creds.subscription_key, creds.region);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
