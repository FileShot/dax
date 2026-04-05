/**
 * Plausible Analytics Integration
 */
'use strict';
const https = require('https');

function plausibleReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'plausible.io', path: `/api/v1${path}`,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
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
  id: 'plausible',
  name: 'Plausible Analytics',
  category: 'analytics',
  icon: 'TrendingUp',
  description: 'Access privacy-friendly web analytics data via Plausible Stats API.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'site_id', label: 'Site ID (domain)', type: 'text', required: true, placeholder: 'yourdomain.com' },
  ],
  async connect(creds) { if (!creds.api_key || !creds.site_id) throw new Error('API key and site ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await plausibleReq('GET', `/stats/realtime/visitors?site_id=${encodeURIComponent(creds.site_id)}`, creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: `Connected — ${r} realtime visitors` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    realtime_visitors: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      return plausibleReq('GET', `/stats/realtime/visitors?site_id=${encodeURIComponent(siteId)}`, creds.api_key);
    },
    get_aggregate: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      const qs = new URLSearchParams({ site_id: siteId, period: params.period || '30d', metrics: params.metrics || 'visitors,pageviews,bounce_rate,visit_duration' }).toString();
      return plausibleReq('GET', `/stats/aggregate?${qs}`, creds.api_key);
    },
    get_timeseries: async (params, creds) => {
      const siteId = params.site_id || creds.site_id;
      const qs = new URLSearchParams({ site_id: siteId, period: params.period || '30d', ...(params.metrics && { metrics: params.metrics }) }).toString();
      return plausibleReq('GET', `/stats/timeseries?${qs}`, creds.api_key);
    },
    get_breakdown: async (params, creds) => {
      if (!params.property) throw new Error('property required (e.g. event:page, visit:source)');
      const siteId = params.site_id || creds.site_id;
      const qs = new URLSearchParams({ site_id: siteId, property: params.property, period: params.period || '30d', limit: String(params.limit || 20), ...(params.metrics && { metrics: params.metrics }) }).toString();
      return plausibleReq('GET', `/stats/breakdown?${qs}`, creds.api_key);
    },
    list_sites: async (_params, creds) => {
      return plausibleReq('GET', '/sites', creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
