/**
 * Namely HRIS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function namelyReq(method, path, body, creds) {
  if (!creds.subdomain) throw new Error('subdomain required');
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: `${creds.subdomain}.namely.com`, path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${creds.access_token}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'namely',
  name: 'Namely',
  category: 'hr',
  icon: 'Users',
  description: 'Manage employee profiles, time off, and HR data with Namely HRIS.',
  configFields: [
    { key: 'subdomain', label: 'Subdomain', type: 'string', required: true, description: 'Your Namely subdomain (e.g. mycompany)' },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.subdomain || !creds.access_token) throw new Error('subdomain and access_token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await namelyReq('GET', '/profiles?per_page=1&page=1', null, creds); return { success: true, message: `Connected — ${r.meta?.total ?? 0} profile(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_profiles: async (params, creds) => namelyReq('GET', `/profiles?per_page=${params.per_page || 25}&page=${params.page || 1}${params.status ? `&filter[status]=${params.status}` : ''}`, null, creds),
    get_profile: async (params, creds) => {
      if (!params.id) throw new Error('id required');
      return namelyReq('GET', `/profiles/${params.id}`, null, creds);
    },
    list_time_off: async (params, creds) => namelyReq('GET', `/time_off_requests?per_page=${params.per_page || 25}&page=${params.page || 1}${params.profile_id ? `&filter[profile_id]=${params.profile_id}` : ''}`, null, creds),
    list_groups: async (params, creds) => namelyReq('GET', `/groups?per_page=${params.per_page || 50}&page=${params.page || 1}${params.type ? `&filter[type]=${params.type}` : ''}`, null, creds),
    list_reports: async (params, creds) => namelyReq('GET', '/reports', null, creds),
    get_current_user: async (params, creds) => namelyReq('GET', '/profiles/me', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
