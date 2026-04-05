/**
 * Cal.com API Integration
 */
'use strict';
const https = require('https');

function calApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.cal.com', path: `/v1${path}${path.includes('?') ? '&' : '?'}apiKey=${apiKey}`, headers: { 'Content-Type': 'application/json' } };
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
  id: 'cal-com',
  name: 'Cal.com',
  category: 'scheduling',
  icon: 'CalendarDays',
  description: 'Manage bookings and event types via Cal.com open scheduling.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await calApi('GET', '/me', creds.api_key); return { success: !!r.user, message: r.user ? `Connected as ${r.user.username}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_me: async (params, creds) => calApi('GET', '/me', creds.api_key),
    list_event_types: async (params, creds) => calApi('GET', '/event-types', creds.api_key),
    list_bookings: async (params, creds) => calApi('GET', `/bookings?take=${params.limit || 20}&skip=${params.offset || 0}`, creds.api_key),
    get_booking: async (params, creds) => { if (!params.booking_id) throw new Error('booking_id required'); return calApi('GET', `/bookings/${params.booking_id}`, creds.api_key); },
    cancel_booking: async (params, creds) => { if (!params.booking_id) throw new Error('booking_id required'); return calApi('DELETE', `/bookings/${params.booking_id}`, creds.api_key, { reason: params.reason || 'Cancelled' }); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
