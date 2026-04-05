/**
 * Calendly API Integration
 */
'use strict';
const https = require('https');

function calendlyApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.calendly.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'calendly',
  name: 'Calendly',
  category: 'scheduling',
  icon: 'Calendar',
  description: 'Manage scheduling, event types, and invitees via Calendly.',
  configFields: [
    { key: 'access_token', label: 'Personal Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await calendlyApi('GET', '/users/me', creds.access_token); return { success: !!r.resource, message: r.resource ? `Connected as ${r.resource.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => calendlyApi('GET', '/users/me', creds.access_token),
    list_event_types: async (params, creds) => {
      const me = await calendlyApi('GET', '/users/me', creds.access_token);
      if (!me.resource) throw new Error('Could not get user');
      return calendlyApi('GET', `/event_types?user=${encodeURIComponent(me.resource.uri)}&count=${params.limit || 20}`, creds.access_token);
    },
    list_events: async (params, creds) => {
      const me = await calendlyApi('GET', '/users/me', creds.access_token);
      if (!me.resource) throw new Error('Could not get user');
      const minTime = params.min_start_time || new Date(Date.now() - 7 * 86400000).toISOString();
      return calendlyApi('GET', `/scheduled_events?user=${encodeURIComponent(me.resource.uri)}&count=${params.limit || 20}&min_start_time=${minTime}`, creds.access_token);
    },
    get_event: async (params, creds) => { if (!params.event_uuid) throw new Error('event_uuid required'); return calendlyApi('GET', `/scheduled_events/${params.event_uuid}`, creds.access_token); },
    list_invitees: async (params, creds) => { if (!params.event_uuid) throw new Error('event_uuid required'); return calendlyApi('GET', `/scheduled_events/${params.event_uuid}/invitees?count=${params.limit || 20}`, creds.access_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
