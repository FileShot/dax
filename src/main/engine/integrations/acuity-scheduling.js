/**
 * Acuity Scheduling (Squarespace) API Integration
 */
'use strict';
const https = require('https');

function acuityApi(method, path, userId, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${userId}:${apiKey}`).toString('base64');
    const opts = { method, hostname: 'acuityscheduling.com', path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' } };
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
  id: 'acuity-scheduling',
  name: 'Acuity Scheduling',
  category: 'scheduling',
  icon: 'CalendarCheck',
  description: 'Manage appointments and availability via Acuity Scheduling.',
  configFields: [
    { key: 'user_id', label: 'User ID', type: 'text', required: true },
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.user_id || !creds.api_key) throw new Error('User ID and API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await acuityApi('GET', '/me', creds.user_id, creds.api_key); return { success: !!r.id, message: `Connected as ${r.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_appointments: async (params, creds) => {
      const qs = new URLSearchParams({ max: params.max || 50 });
      if (params.minDate) qs.set('minDate', params.minDate);
      if (params.maxDate) qs.set('maxDate', params.maxDate);
      return acuityApi('GET', `/appointments?${qs}`, creds.user_id, creds.api_key);
    },
    get_appointment: async (params, creds) => { if (!params.appointment_id) throw new Error('appointment_id required'); return acuityApi('GET', `/appointments/${params.appointment_id}`, creds.user_id, creds.api_key); },
    schedule_appointment: async (params, creds) => {
      if (!params.datetime || !params.appointmentTypeID || !params.firstName || !params.lastName || !params.email) throw new Error('datetime, appointmentTypeID, firstName, lastName, email required');
      return acuityApi('POST', '/appointments', creds.user_id, creds.api_key, { datetime: params.datetime, appointmentTypeID: params.appointmentTypeID, firstName: params.firstName, lastName: params.lastName, email: params.email });
    },
    cancel_appointment: async (params, creds) => { if (!params.appointment_id) throw new Error('appointment_id required'); return acuityApi('PUT', `/appointments/${params.appointment_id}/cancel`, creds.user_id, creds.api_key, { cancelNote: params.note || '' }); },
    list_appointment_types: async (params, creds) => acuityApi('GET', '/appointment-types', creds.user_id, creds.api_key),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
