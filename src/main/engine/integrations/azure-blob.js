/**
 * Azure Blob Storage Integration
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function azureBlobRequest(method, account, containerName, blobName, accountKey, headers = {}) {
  return new Promise((resolve, reject) => {
    const hostname = `${account}.blob.core.windows.net`;
    let path = '/';
    if (containerName) path += containerName;
    if (blobName) path += `/${encodeURIComponent(blobName)}`;
    const now = new Date().toUTCString();
    const version = '2020-10-02';
    const allHeaders = { 'x-ms-date': now, 'x-ms-version': version, ...headers };
    const canonicalizedHeaders = Object.keys(allHeaders).filter((k) => k.startsWith('x-ms-')).sort().map((k) => `${k}:${allHeaders[k]}`).join('\n');
    const canonicalizedResource = `/${account}${path}`;
    const stringToSign = `${method}\n\n\n\n\n\n\n\n\n\n\n\n${canonicalizedHeaders}\n${canonicalizedResource}`;
    const sig = crypto.createHmac('sha256', Buffer.from(accountKey, 'base64')).update(stringToSign, 'utf8').digest('base64');
    allHeaders['Authorization'] = `SharedKey ${account}:${sig}`;
    const opts = { method, hostname, path, headers: allHeaders };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, statusCode: res.statusCode }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'azure-blob',
  name: 'Azure Blob Storage',
  category: 'storage',
  icon: 'Cloud',
  description: 'Manage containers and blobs in Azure Blob Storage.',
  configFields: [
    { key: 'account_name', label: 'Storage Account Name', type: 'text', required: true },
    { key: 'account_key', label: 'Account Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.account_name || !creds.account_key) throw new Error('Account name and key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await azureBlobRequest('GET', creds.account_name, null, null, creds.account_key, { 'comp': 'list' }); return { success: true, message: 'Connected to Azure Blob Storage' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_containers: async (params, creds) => azureBlobRequest('GET', creds.account_name, null, null, creds.account_key, { 'comp': 'list' }),
    list_blobs: async (params, creds) => {
      if (!params.container) throw new Error('container required');
      return azureBlobRequest('GET', creds.account_name, `${params.container}?restype=container&comp=list`, null, creds.account_key);
    },
    get_blob_properties: async (params, creds) => {
      if (!params.container || !params.blob) throw new Error('container and blob required');
      return azureBlobRequest('HEAD', creds.account_name, params.container, params.blob, creds.account_key);
    },
    delete_blob: async (params, creds) => {
      if (!params.container || !params.blob) throw new Error('container and blob required');
      return azureBlobRequest('DELETE', creds.account_name, params.container, params.blob, creds.account_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
