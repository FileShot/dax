/**
 * Komoot Route Planning API Integration
 */
'use strict';
const https = require('https');

function komootReq(method, path, body, creds) {
  return new Promise((resolve, reject) => {
    const authHeader = (creds.email && creds.password)
      ? 'Basic ' + Buffer.from(`${creds.email}:${creds.password}`).toString('base64')
      : (creds.token ? `Bearer ${creds.token}` : '');
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: 'api.komoot.de', path: `/v007${path}`,
      headers: { 'Accept': 'application/json', ...(authHeader && { 'Authorization': authHeader }), ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) },
    };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'komoot',
  name: 'Komoot',
  category: 'travel',
  icon: 'Mountain',
  description: 'Plan outdoor routes and access hiking, cycling, and walking tours via Komoot API.',
  configFields: [
    { key: 'email', label: 'Email', type: 'text', required: false },
    { key: 'password', label: 'Password', type: 'password', required: false },
    { key: 'token', label: 'Bearer Token (alternative to email/password)', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.email && !creds.token) throw new Error('email+password or token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      if (!creds.email && !creds.token) return { success: false, message: 'Credentials required' };
      // Try anonymous fetch of a known public endpoint
      const r = await komootReq('GET', '/highlights/feed/', null, creds);
      if (r.error) return { success: false, message: r.error };
      return { success: true, message: 'Connected to Komoot' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return komootReq('GET', `/users/${params.user_id}/`, null, creds);
    },
    list_tours: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const qs = params.type ? `?type=${params.type}` : '';
      return komootReq('GET', `/users/${params.user_id}/tours/${qs}`, null, creds);
    },
    get_tour: async (params, creds) => {
      if (!params.tour_id) throw new Error('tour_id required');
      return komootReq('GET', `/tours/${params.tour_id}/`, null, creds);
    },
    search_route: async (params, creds) => {
      if (!params.sport || !params.start || !params.end) throw new Error('sport, start ({lat,lng}), and end ({lat,lng}) required');
      const body = { sport: params.sport, start_point: params.start, end_point: params.end, ...(params.waypoints && { waypoints: params.waypoints }) };
      return komootReq('POST', '/routing/route/', body, creds);
    },
    get_highlight: async (params, creds) => {
      if (!params.highlight_id) throw new Error('highlight_id required');
      return komootReq('GET', `/highlights/${params.highlight_id}/`, null, creds);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
