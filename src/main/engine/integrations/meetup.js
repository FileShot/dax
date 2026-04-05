/**
 * Meetup API Integration
 */
'use strict';
const https = require('https');

function meetupGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.meetup.com', path, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'meetup',
  name: 'Meetup',
  category: 'social',
  icon: 'Users',
  description: 'Discover and manage Meetup groups, events, and member data.',
  configFields: [{ key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await meetupGet('/2/member/self', creds.access_token); if (r.errors) return { success: false, message: r.errors[0]?.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_self: async (_p, creds) => meetupGet('/2/member/self', creds.access_token),
    get_groups: async (params, creds) => {
      const qs = new URLSearchParams({ member_id: 'self', page: String(params.page || 20), offset: String(params.offset || 0) }).toString();
      return meetupGet(`/2/groups?${qs}`, creds.access_token);
    },
    get_events: async (params, creds) => {
      if (!params.group_urlname) throw new Error('group_urlname required');
      const qs = new URLSearchParams({ status: params.status || 'upcoming', page: String(params.page || 20) }).toString();
      return meetupGet(`/${params.group_urlname}/events?${qs}`, creds.access_token);
    },
    get_event: async (params, creds) => {
      if (!params.group_urlname || !params.event_id) throw new Error('group_urlname and event_id required');
      return meetupGet(`/${params.group_urlname}/events/${params.event_id}`, creds.access_token);
    },
    find_groups: async (params, creds) => {
      if (!params.zip || !params.country) throw new Error('zip and country required');
      const qs = new URLSearchParams({ zip: params.zip, country: params.country, radius: String(params.radius || 25), page: String(params.page || 20) }).toString();
      return meetupGet(`/2/open_events?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
