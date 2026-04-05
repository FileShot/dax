/**
 * Wasabi Cloud Storage (S3-compatible) Integration
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function sign(key, msg) { return crypto.createHmac('sha256', key).update(msg).digest(); }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function wasabiRequest(method, bucket, objectKey, region, accessKey, secretKey, body = null) {
  return new Promise((resolve, reject) => {
    const hostname = bucket ? `${bucket}.s3.${region}.wasabisys.com` : `s3.${region}.wasabisys.com`;
    const path = objectKey ? `/${encodeURIComponent(objectKey)}` : '/';
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
    const amzDate = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const payloadHash = sha256(body || '');
    const headers = { 'Host': hostname, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash };
    if (body && method !== 'GET') headers['Content-Type'] = 'application/xml';
    const signedHeaderKeys = Object.keys(headers).sort().map((k) => k.toLowerCase()).join(';');
    const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k.toLowerCase()}:${headers[k]}`).join('\n') + '\n';
    const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaderKeys}\n${payloadHash}`;
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    let signingKey = sign(`AWS4${secretKey}`, dateStamp);
    signingKey = sign(signingKey, region);
    signingKey = sign(signingKey, 's3');
    signingKey = sign(signingKey, 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;
    const opts = { method, hostname, path, headers };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, statusCode: res.statusCode }); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'wasabi',
  name: 'Wasabi',
  category: 'storage',
  icon: 'Database',
  description: 'Manage files and buckets in Wasabi S3-compatible storage.',
  configFields: [
    { key: 'access_key', label: 'Access Key', type: 'text', required: true },
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
    { key: 'region', label: 'Region', type: 'text', required: false, placeholder: 'us-east-1' },
  ],
  async connect(creds) { if (!creds.access_key || !creds.secret_key) throw new Error('Access key and secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await wasabiRequest('GET', null, null, creds.region || 'us-east-1', creds.access_key, creds.secret_key); return { success: true, message: 'Connected to Wasabi' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_buckets: async (params, creds) => wasabiRequest('GET', null, null, creds.region || 'us-east-1', creds.access_key, creds.secret_key),
    list_objects: async (params, creds) => { if (!params.bucket) throw new Error('bucket required'); return wasabiRequest('GET', params.bucket, null, creds.region || 'us-east-1', creds.access_key, creds.secret_key); },
    delete_object: async (params, creds) => { if (!params.bucket || !params.key) throw new Error('bucket and key required'); return wasabiRequest('DELETE', params.bucket, params.key, creds.region || 'us-east-1', creds.access_key, creds.secret_key); },
    head_object: async (params, creds) => { if (!params.bucket || !params.key) throw new Error('bucket and key required'); return wasabiRequest('HEAD', params.bucket, params.key, creds.region || 'us-east-1', creds.access_key, creds.secret_key); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
