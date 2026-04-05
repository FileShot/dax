/**
 * Canvas LMS Education Platform Integration
 */
'use strict';
const https = require('https');

function canvasGet(hostname, path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname, path: `/api/v1${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'canvas-lms',
  name: 'Canvas LMS',
  category: 'education',
  icon: 'GraduationCap',
  description: 'Access Canvas LMS course, assignment, and enrollment data via the Canvas REST API.',
  configFields: [
    { key: 'hostname', label: 'Canvas Domain (e.g. school.instructure.com)', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.hostname || !creds.access_token) throw new Error('Hostname and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await canvasGet(creds.hostname, '/users/self', creds.access_token); if (r.errors) return { success: false, message: r.errors[0]?.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.name || r.login_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_courses: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: String(params.per_page || 20), ...(params.enrollment_type && { enrollment_type: params.enrollment_type }), ...(params.state && { 'state[]': params.state }) }).toString();
      return canvasGet(creds.hostname, `/courses?${qs}`, creds.access_token);
    },
    get_course: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      return canvasGet(creds.hostname, `/courses/${params.course_id}`, creds.access_token);
    },
    list_assignments: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      const qs = new URLSearchParams({ per_page: String(params.per_page || 20) }).toString();
      return canvasGet(creds.hostname, `/courses/${params.course_id}/assignments?${qs}`, creds.access_token);
    },
    get_assignment: async (params, creds) => {
      if (!params.course_id || !params.assignment_id) throw new Error('course_id and assignment_id required');
      return canvasGet(creds.hostname, `/courses/${params.course_id}/assignments/${params.assignment_id}`, creds.access_token);
    },
    list_students: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      const qs = new URLSearchParams({ per_page: String(params.per_page || 50), enrollment_type: 'student' }).toString();
      return canvasGet(creds.hostname, `/courses/${params.course_id}/enrollments?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
