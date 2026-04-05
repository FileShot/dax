/**
 * Zoom API Integration
 */
'use strict';
const https = require('https');

function zoomApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.zoom.us', path: `/v2${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'zoom',
  name: 'Zoom',
  category: 'scheduling',
  icon: 'Video',
  description: 'Manage Zoom meetings, webinars, and recordings.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await zoomApi('GET', '/users/me', creds.access_token); return { success: !!r.id, message: r.email ? `Connected as ${r.email}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_meetings: async (params, creds) => zoomApi('GET', `/users/me/meetings?type=${params.type || 'scheduled'}&page_size=${params.limit || 30}`, creds.access_token),
    get_meeting: async (params, creds) => { if (!params.meeting_id) throw new Error('meeting_id required'); return zoomApi('GET', `/meetings/${params.meeting_id}`, creds.access_token); },
    create_meeting: async (params, creds) => {
      if (!params.topic) throw new Error('topic required');
      return zoomApi('POST', '/users/me/meetings', creds.access_token, { topic: params.topic, type: params.type || 2, start_time: params.start_time, duration: params.duration || 60, agenda: params.agenda || '', settings: { host_video: true, participant_video: true } });
    },
    delete_meeting: async (params, creds) => { if (!params.meeting_id) throw new Error('meeting_id required'); return zoomApi('DELETE', `/meetings/${params.meeting_id}`, creds.access_token); },
    list_recordings: async (params, creds) => {
      const from = params.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = params.to || new Date().toISOString().slice(0, 10);
      return zoomApi('GET', `/users/me/recordings?from=${from}&to=${to}&page_size=${params.limit || 30}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
