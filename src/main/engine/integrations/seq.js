/**
 * Seq Structured Log Server API Integration (self-hosted or cloud)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function seqReq(method, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const host = (creds.server_url || 'http://localhost:5341').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const [hostname, portStr] = host.split(':');
  const port = parseInt(portStr || '5341', 10);
  const apiKey = creds.api_key ? `?apiKey=${creds.api_key}` : '';
  const sep = path.includes('?') ? '&' : '?';
  const fullPath = `${path}${creds.api_key ? `${sep}apiKey=${creds.api_key}` : ''}`;
  const opts = { method, hostname, port, path: `/api${fullPath.replace(sep + 'apiKey=' + creds.api_key, apiKey)}`, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  // Simpler approach
  const pathFull = `/api${path}${creds.api_key ? `${path.includes('?') ? '&' : '?'}apiKey=${creds.api_key}` : ''}`;
  const opts2 = { method, hostname, port, path: pathFull, headers: { 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts2, bodyStr);
}

module.exports = {
  id: 'seq',
  name: 'Seq',
  category: 'monitoring',
  icon: 'List',
  description: 'Query structured logs and manage signals and alerts in Seq log server.',
  configFields: [
    { key: 'server_url', label: 'Server URL (e.g. https://seq.example.com)', type: 'text', required: true },
    { key: 'api_key', label: 'API Key (optional for local)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.server_url) throw new Error('server_url required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await seqReq('GET', '/diagnostics', null, creds); return { success: true, message: `Seq v${r.version || 'connected'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_events: async (params, creds) => seqReq('GET', `/events?filter=${encodeURIComponent(params.filter || '')}&count=${params.count || 50}&fromDateUtc=${params.from || ''}&toDateUtc=${params.to || ''}`, null, creds),
    get_event: async (params, creds) => {
      if (!params.event_id) throw new Error('event_id required');
      return seqReq('GET', `/events/${params.event_id}`, null, creds);
    },
    list_signals: async (params, creds) => seqReq('GET', '/signals?shared=true', null, creds),
    list_dashboards: async (params, creds) => seqReq('GET', '/dashboards', null, creds),
    get_diagnostics: async (params, creds) => seqReq('GET', '/diagnostics', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
