/**
 * Mux Video API Integration
 */
'use strict';
const https = require('https');

function muxApi(method, path, tokenId, tokenSecret, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');
    const opts = { method, hostname: 'api.mux.com', path, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'mux',
  name: 'Mux',
  category: 'design',
  icon: 'Play',
  description: 'Manage video streaming, encoding, and analytics with Mux.',
  configFields: [
    { key: 'token_id', label: 'Access Token ID', type: 'text', required: true },
    { key: 'token_secret', label: 'Access Token Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.token_id || !creds.token_secret) throw new Error('Token ID and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await muxApi('GET', '/video/v1/assets?limit=1', creds.token_id, creds.token_secret); return { success: !!r.data, message: r.data ? 'Connected to Mux' : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_assets: async (params, creds) => muxApi('GET', `/video/v1/assets?limit=${params.limit || 20}&page=${params.page || 1}`, creds.token_id, creds.token_secret),
    get_asset: async (params, creds) => { if (!params.asset_id) throw new Error('asset_id required'); return muxApi('GET', `/video/v1/assets/${params.asset_id}`, creds.token_id, creds.token_secret); },
    create_asset: async (params, creds) => {
      if (!params.input_url) throw new Error('input_url required');
      return muxApi('POST', '/video/v1/assets', creds.token_id, creds.token_secret, { input: [{ url: params.input_url }], playback_policy: [params.playback_policy || 'public'] });
    },
    delete_asset: async (params, creds) => { if (!params.asset_id) throw new Error('asset_id required'); return muxApi('DELETE', `/video/v1/assets/${params.asset_id}`, creds.token_id, creds.token_secret); },
    list_live_streams: async (params, creds) => muxApi('GET', `/video/v1/live-streams?limit=${params.limit || 20}`, creds.token_id, creds.token_secret),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
