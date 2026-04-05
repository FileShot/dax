/**
 * AWS Translate Integration (SigV4)
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function signV4(method, region, accessKey, secretKey, payload) {
  const service = 'translate';
  const host = `translate.${region}.amazonaws.com`;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateOnly = dateStamp.slice(0, 8);
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${dateStamp}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const payloadHash = sha256(payload);
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateOnly}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${scope}\n${sha256(canonicalRequest)}`;
  let signingKey = hmac(`AWS4${secretKey}`, dateOnly);
  signingKey = hmac(signingKey, region);
  signingKey = hmac(signingKey, service);
  signingKey = hmac(signingKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign).toString('hex');
  return {
    Host: host,
    'Content-Type': 'application/x-amz-json-1.1',
    'x-amz-date': dateStamp,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function translateRequest(action, body, creds) {
  const region = creds.region || 'us-east-1';
  const payload = JSON.stringify(body);
  const headers = signV4('POST', region, creds.access_key_id, creds.secret_access_key, payload);
  return new Promise((resolve, reject) => {
    const opts = { method: 'POST', hostname: `translate.${region}.amazonaws.com`, path: '/', headers: { ...headers, 'X-Amz-Target': `AWSShineFrontendService_20170701.${action}`, 'Content-Length': Buffer.byteLength(payload) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  id: 'aws-translate',
  name: 'AWS Translate',
  category: 'translation',
  icon: 'ArrowLeftRight',
  description: 'Translate text in real time using Amazon Translate neural machine translation.',
  configFields: [
    { key: 'access_key_id', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'region', label: 'Region (e.g. us-east-1)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_key_id || !creds.secret_access_key) throw new Error('Access key ID and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await translateRequest('ListLanguages', { MaxResults: 1 }, creds); return { success: !!r.Languages || r.languages !== undefined, message: r.message || 'Connected to AWS Translate' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    translate_text: async (params, creds) => {
      if (!params.text || !params.target_language_code) throw new Error('text and target_language_code required');
      return translateRequest('TranslateText', { Text: params.text, SourceLanguageCode: params.source_language_code || 'auto', TargetLanguageCode: params.target_language_code, ...(params.terminology_names && { TerminologyNames: params.terminology_names }) }, creds);
    },
    list_languages: async (params, creds) => {
      return translateRequest('ListLanguages', { MaxResults: params.max_results || 100, ...(params.next_token && { NextToken: params.next_token }) }, creds);
    },
    detect_dominant_language: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      // Use auto detection by translating to English and reading detected source
      return translateRequest('TranslateText', { Text: params.text.slice(0, 500), SourceLanguageCode: 'auto', TargetLanguageCode: 'en' }, creds);
    },
    list_terminologies: async (params, creds) => {
      return translateRequest('ListTerminologies', { MaxResults: params.max_results || 20, ...(params.next_token && { NextToken: params.next_token }) }, creds);
    },
    batch_translate: async (params, creds) => {
      if (!params.texts || !Array.isArray(params.texts) || !params.target_language_code) throw new Error('texts array and target_language_code required');
      const results = await Promise.all(params.texts.map(text => translateRequest('TranslateText', { Text: text, SourceLanguageCode: params.source_language_code || 'auto', TargetLanguageCode: params.target_language_code }, creds)));
      return { translations: results };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
