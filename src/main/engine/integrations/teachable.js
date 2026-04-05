/**
 * Teachable Online Course Platform Integration
 */
'use strict';
const https = require('https');

function teachableReq(method, path, apiKey, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'developers.teachable.com', path: `/v1${path}`,
      headers: { 'apiKey': apiKey, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
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
  id: 'teachable',
  name: 'Teachable',
  category: 'education',
  icon: 'PlayCircle',
  description: 'Manage Teachable online courses, students, and enrollment data.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key) throw new Error('API key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await teachableReq('GET', '/users/me', creds.api_key); if (r.error) return { success: false, message: r.error }; return { success: true, message: `Connected as ${r.user?.email || 'Teachable user'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_courses: async (params, creds) => {
      const qs = new URLSearchParams({ per: String(params.per || 20), page: String(params.page || 1) }).toString();
      return teachableReq('GET', `/courses?${qs}`, creds.api_key);
    },
    get_course: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      return teachableReq('GET', `/courses/${params.course_id}`, creds.api_key);
    },
    list_users: async (params, creds) => {
      const qs = new URLSearchParams({ per: String(params.per || 20), page: String(params.page || 1) }).toString();
      return teachableReq('GET', `/users?${qs}`, creds.api_key);
    },
    get_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return teachableReq('GET', `/users/${params.user_id}`, creds.api_key);
    },
    list_enrollments: async (params, creds) => {
      const qs = new URLSearchParams({ per: String(params.per || 20), page: String(params.page || 1), ...(params.course_id && { course_id: String(params.course_id) }) }).toString();
      return teachableReq('GET', `/enrollments?${qs}`, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
