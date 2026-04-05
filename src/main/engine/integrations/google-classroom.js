/**
 * Google Classroom Education Integration
 */
'use strict';
const https = require('https');

function gcGet(path, accessToken) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'classroom.googleapis.com', path: `/v1${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' } };
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
  id: 'google-classroom',
  name: 'Google Classroom',
  category: 'education',
  icon: 'School',
  description: 'Access Google Classroom courses, coursework, and student submissions.',
  configFields: [
    { key: 'access_token', label: 'OAuth2 Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await gcGet('/courses?pageSize=1', creds.access_token); if (r.error) return { success: false, message: r.error.message || 'Auth failed' }; return { success: true, message: 'Connected to Google Classroom' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_courses: async (params, creds) => {
      const qs = new URLSearchParams({ pageSize: String(params.pageSize || 20), ...(params.teacherId && { teacherId: params.teacherId }), ...(params.studentId && { studentId: params.studentId }), ...(params.courseStates && { courseStates: params.courseStates }), ...(params.pageToken && { pageToken: params.pageToken }) }).toString();
      return gcGet(`/courses?${qs}`, creds.access_token);
    },
    get_course: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      return gcGet(`/courses/${params.course_id}`, creds.access_token);
    },
    list_students: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      const qs = new URLSearchParams({ pageSize: String(params.pageSize || 30) }).toString();
      return gcGet(`/courses/${params.course_id}/students?${qs}`, creds.access_token);
    },
    list_course_work: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      const qs = new URLSearchParams({ pageSize: String(params.pageSize || 20) }).toString();
      return gcGet(`/courses/${params.course_id}/courseWork?${qs}`, creds.access_token);
    },
    list_submissions: async (params, creds) => {
      if (!params.course_id || !params.coursework_id) throw new Error('course_id and coursework_id required');
      const qs = new URLSearchParams({ pageSize: String(params.pageSize || 30) }).toString();
      return gcGet(`/courses/${params.course_id}/courseWork/${params.coursework_id}/studentSubmissions?${qs}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
