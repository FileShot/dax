/**
 * SonarQube API Integration
 */
'use strict';
const https = require('https');
const http = require('http');

function sonarApi(method, baseUrl, path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const auth = Buffer.from(`${token}:`).toString('base64');
    const opts = { method, hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 9000), path: `/api${path}`, headers: { 'Authorization': `Basic ${auth}` } };
    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'sonarqube',
  name: 'SonarQube',
  category: 'security',
  icon: 'Bug',
  description: 'Analyze code quality and security issues with SonarQube.',
  configFields: [
    { key: 'base_url', label: 'SonarQube URL', type: 'text', required: true, placeholder: 'http://localhost:9000' },
    { key: 'token', label: 'User Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.base_url || !creds.token) throw new Error('URL and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await sonarApi('GET', creds.base_url, '/system/status', creds.token); return { success: r.status === 'UP', message: r.status === 'UP' ? `SonarQube v${r.version}` : 'Not available' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_projects: async (params, creds) => sonarApi('GET', creds.base_url, `/projects/search?ps=${params.limit || 50}&p=${params.page || 1}`, creds.token),
    get_issues: async (params, creds) => {
      if (!params.project_key) throw new Error('project_key required');
      const severities = params.severities ? `&severities=${params.severities}` : '';
      return sonarApi('GET', creds.base_url, `/issues/search?componentKeys=${encodeURIComponent(params.project_key)}&ps=${params.limit || 50}${severities}`, creds.token);
    },
    get_measures: async (params, creds) => {
      if (!params.project_key) throw new Error('project_key required');
      const metrics = params.metrics || 'bugs,vulnerabilities,code_smells,coverage';
      return sonarApi('GET', creds.base_url, `/measures/component?component=${encodeURIComponent(params.project_key)}&metricKeys=${metrics}`, creds.token);
    },
    get_quality_gate: async (params, creds) => { if (!params.project_key) throw new Error('project_key required'); return sonarApi('GET', creds.base_url, `/qualitygates/project_status?projectKey=${encodeURIComponent(params.project_key)}`, creds.token); },
    get_system_status: async (params, creds) => sonarApi('GET', creds.base_url, '/system/status', creds.token),
    list_rules: async (params, creds) => {
      const lang = params.languages ? `&languages=${params.languages}` : '';
      return sonarApi('GET', creds.base_url, `/rules/search?ps=${params.limit || 50}${lang}`, creds.token);
    },
    get_hotspots: async (params, creds) => {
      if (!params.project_key) throw new Error('project_key required');
      return sonarApi('GET', creds.base_url, `/hotspots/search?projectKey=${encodeURIComponent(params.project_key)}&ps=${params.limit || 50}`, creds.token);
    },
    get_duplications: async (params, creds) => {
      if (!params.component_key) throw new Error('component_key required');
      return sonarApi('GET', creds.base_url, `/duplications/show?key=${encodeURIComponent(params.component_key)}`, creds.token);
    },
    list_quality_profiles: async (params, creds) => {
      const lang = params.language ? `?language=${params.language}` : '';
      return sonarApi('GET', creds.base_url, `/qualityprofiles/search${lang}`, creds.token);
    },
    get_coverage: async (params, creds) => {
      if (!params.component) throw new Error('component required');
      return sonarApi('GET', creds.base_url, `/measures/component?component=${encodeURIComponent(params.component)}&metricKeys=coverage,line_coverage,branch_coverage,uncovered_lines`, creds.token);
    },
    search_components: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return sonarApi('GET', creds.base_url, `/components/search?q=${encodeURIComponent(params.query)}&ps=${params.limit || 20}`, creds.token);
    },
    get_activity: async (params, creds) => {
      const qs = params.project_key ? `?component=${encodeURIComponent(params.project_key)}` : '';
      return sonarApi('GET', creds.base_url, `/ce/activity${qs}`, creds.token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
