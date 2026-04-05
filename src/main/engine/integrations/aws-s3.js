/**
 * AWS S3 Integration (using native HTTPS with Signature V4)
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function signV4(method, path, region, accessKey, secretKey, service = 's3', payload = '', queryParams = '', headers = {}) {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateOnly = dateStamp.slice(0, 8);
  const host = `${service}.${region}.amazonaws.com`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${sha256(payload)}\nx-amz-date:${dateStamp}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `${method}\n${path}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
  const scope = `${dateOnly}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${scope}\n${sha256(canonicalRequest)}`;
  let signingKey = hmac(`AWS4${secretKey}`, dateOnly);
  signingKey = hmac(signingKey, region);
  signingKey = hmac(signingKey, service);
  signingKey = hmac(signingKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign).toString('hex');
  return {
    headers: {
      ...headers,
      'Host': host,
      'x-amz-date': dateStamp,
      'x-amz-content-sha256': sha256(payload),
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function s3Request(method, path, creds, body = '', queryStr = '') {
  const region = creds.region || 'us-east-1';
  const signed = signV4(method, path, region, creds.access_key_id, creds.secret_access_key, 's3', body, queryStr);
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: `s3.${region}.amazonaws.com`, path: queryStr ? `${path}?${queryStr}` : path, headers: signed.headers };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.headers['content-type']?.includes('xml')) {
          // Simple XML → object for common S3 responses
          const extract = (tag) => { const m = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs').exec(data); return m ? m[1] : null; };
          const extractAll = (tag) => { const results = []; let m; const re = new RegExp(`<${tag}>(.*?)</${tag}>`, 'gs'); while ((m = re.exec(data)) !== null) results.push(m[1]); return results; };
          resolve({ statusCode: res.statusCode, xml: data, keys: extractAll('Key'), names: extractAll('Name') });
        } else {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'aws-s3',
  name: 'AWS S3',
  category: 'devops',
  icon: 'Cloud',
  description: 'Manage AWS S3 buckets and objects.',
  configFields: [
    { key: 'access_key_id', label: 'Access Key ID', type: 'text', required: true },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
    { key: 'region', label: 'Region (default: us-east-1)', type: 'text', required: false },
  ],
  async connect(creds) { if (!creds.access_key_id || !creds.secret_access_key) throw new Error('Access key and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await s3Request('GET', '/', creds); return { success: r.statusCode === 200, message: r.statusCode === 200 ? `Connected (${r.names?.length || 0} buckets)` : `Error: ${r.statusCode}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_buckets: async (params, creds) => s3Request('GET', '/', creds),
    list_objects: async (params, creds) => {
      if (!params.bucket) throw new Error('bucket required');
      const prefix = params.prefix ? `prefix=${encodeURIComponent(params.prefix)}&` : '';
      const maxKeys = `max-keys=${params.limit || 100}`;
      return s3Request('GET', `/${params.bucket}/`, creds, '', `list-type=2&${prefix}${maxKeys}`);
    },
    head_object: async (params, creds) => {
      if (!params.bucket || !params.key) throw new Error('bucket and key required');
      return s3Request('HEAD', `/${params.bucket}/${params.key}`, creds);
    },
    delete_object: async (params, creds) => {
      if (!params.bucket || !params.key) throw new Error('bucket and key required');
      return s3Request('DELETE', `/${params.bucket}/${params.key}`, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
