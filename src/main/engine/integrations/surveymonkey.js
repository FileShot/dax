/**
 * SurveyMonkey API Integration
 */
'use strict';
const https = require('https');

function smApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.surveymonkey.com', path: `/v3${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'surveymonkey',
  name: 'SurveyMonkey',
  category: 'forms',
  icon: 'BarChart2',
  description: 'Create and analyze surveys with SurveyMonkey.',
  configFields: [
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await smApi('GET', '/users/me', creds.access_token); return { success: !!r.id, message: `Connected as ${r.email}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_surveys: async (params, creds) => {
      const qs = new URLSearchParams({ per_page: params.per_page || 25, page: params.page || 1 });
      return smApi('GET', `/surveys?${qs}`, creds.access_token);
    },
    get_survey: async (params, creds) => { if (!params.survey_id) throw new Error('survey_id required'); return smApi('GET', `/surveys/${params.survey_id}/details`, creds.access_token); },
    list_responses: async (params, creds) => {
      if (!params.survey_id) throw new Error('survey_id required');
      const qs = new URLSearchParams({ per_page: params.per_page || 50 });
      return smApi('GET', `/surveys/${params.survey_id}/responses?${qs}`, creds.access_token);
    },
    get_response: async (params, creds) => {
      if (!params.survey_id || !params.response_id) throw new Error('survey_id and response_id required');
      return smApi('GET', `/surveys/${params.survey_id}/responses/${params.response_id}`, creds.access_token);
    },
    get_summary: async (params, creds) => { if (!params.survey_id) throw new Error('survey_id required'); return smApi('GET', `/surveys/${params.survey_id}/rollups`, creds.access_token); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
