/**
 * Shortcut (formerly Clubhouse) API Integration
 */
'use strict';
const https = require('https');

function scApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.app.shortcut.com', path: `/api/v3${path}`, headers: { 'Shortcut-Token': token, 'Content-Type': 'application/json' } };
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
  id: 'shortcut',
  name: 'Shortcut',
  category: 'project-management',
  icon: 'Bookmark',
  description: 'Manage stories, epics, and workflows in Shortcut (Clubhouse).',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await scApi('GET', '/member', creds.api_token); return { success: !!r.id, message: `Connected as ${r.profile?.name}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_stories: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return scApi('GET', `/search/stories?query=${encodeURIComponent(params.query)}&page_size=${params.page_size || 25}`, creds.api_token);
    },
    get_story: async (params, creds) => { if (!params.story_id) throw new Error('story_id required'); return scApi('GET', `/stories/${params.story_id}`, creds.api_token); },
    create_story: async (params, creds) => {
      if (!params.name || !params.project_id) throw new Error('name and project_id required');
      return scApi('POST', '/stories', creds.api_token, { name: params.name, project_id: params.project_id, story_type: params.story_type || 'feature', description: params.description || '', estimate: params.estimate || null });
    },
    update_story: async (params, creds) => {
      if (!params.story_id) throw new Error('story_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.workflow_state_id) body.workflow_state_id = params.workflow_state_id;
      if (params.estimate) body.estimate = params.estimate;
      return scApi('PUT', `/stories/${params.story_id}`, creds.api_token, body);
    },
    list_projects: async (params, creds) => scApi('GET', '/projects', creds.api_token),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
