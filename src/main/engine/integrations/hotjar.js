/**
 * Hotjar User Behavior Analytics Integration
 */
'use strict';
const https = require('https');

function hotjarReq(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'insights.hotjar.com', path: `/api/v2${path}`,
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
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
  id: 'hotjar',
  name: 'Hotjar',
  category: 'analytics',
  icon: 'Flame',
  description: 'Access Hotjar heatmaps, recordings, surveys, and site analytics data.',
  configFields: [
    { key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true },
    { key: 'site_id', label: 'Site ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.access_token || !creds.site_id) throw new Error('Access token and site ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hotjarReq('GET', `/sites/${creds.site_id}`, creds.access_token); if (r.error || r.status === 401) return { success: false, message: r.message || 'Auth failed' }; return { success: true, message: `Connected to site: ${r.name || creds.site_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_site: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      return hotjarReq('GET', `/sites/${siteId}`, creds.access_token);
    },
    list_heatmaps: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      return hotjarReq('GET', `/sites/${siteId}/heatmaps`, creds.access_token);
    },
    get_recordings: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      const qs = new URLSearchParams({ limit: String(params.limit || 20), ...(params.offset && { offset: String(params.offset) }) }).toString();
      return hotjarReq('GET', `/sites/${siteId}/recordings?${qs}`, creds.access_token);
    },
    list_surveys: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      return hotjarReq('GET', `/sites/${siteId}/surveys`, creds.access_token);
    },
    list_funnels: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      return hotjarReq('GET', `/sites/${siteId}/funnels`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
