/**
 * Moodle LMS Web Services Integration
 */
'use strict';
const https = require('https');
const http = require('http');
const url = require('url');

function moodleCall(siteUrl, token, wsfunction, params) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(siteUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const qs = new URLSearchParams({ wstoken: token, wsfunction, moodlewsrestformat: 'json', ...params }).toString();
    const path = `${parsed.pathname?.replace(/\/$/, '')}/webservice/rest/server.php?${qs}`;
    const opts = { method: 'GET', hostname: parsed.hostname, port: parsed.port || (isHttps ? 443 : 80), path, headers: { 'Accept': 'application/json' } };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'moodle',
  name: 'Moodle',
  category: 'education',
  icon: 'BookOpen',
  description: 'Interact with Moodle LMS courses, users, and grades via Moodle Web Services.',
  configFields: [
    { key: 'site_url', label: 'Moodle Site URL', type: 'text', required: true, placeholder: 'https://moodle.example.com' },
    { key: 'token', label: 'Web Service Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.site_url || !creds.token) throw new Error('Site URL and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await moodleCall(creds.site_url, creds.token, 'core_webservice_get_site_info', {}); if (r.exception) return { success: false, message: r.message || 'Auth failed' }; return { success: true, message: `Connected to ${r.sitename || creds.site_url}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_site_info: async (_params, creds) => moodleCall(creds.site_url, creds.token, 'core_webservice_get_site_info', {}),
    get_courses: async (params, creds) => {
      const wsparams = params.ids ? { 'options[ids][0]': String(params.ids[0]) } : {};
      return moodleCall(creds.site_url, creds.token, 'core_course_get_courses', wsparams);
    },
    get_users: async (params, creds) => {
      const key = params.key || 'email';
      const value = params.value || '';
      return moodleCall(creds.site_url, creds.token, 'core_user_get_users', { 'criteria[0][key]': key, 'criteria[0][value]': value });
    },
    get_enrolled_users: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      return moodleCall(creds.site_url, creds.token, 'core_enrol_get_enrolled_users', { courseid: String(params.course_id) });
    },
    get_grades: async (params, creds) => {
      if (!params.course_id) throw new Error('course_id required');
      return moodleCall(creds.site_url, creds.token, 'gradereport_user_get_grade_items', { courseid: String(params.course_id), ...(params.user_id && { userid: String(params.user_id) }) });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
