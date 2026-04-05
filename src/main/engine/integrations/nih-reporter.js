/**
 * NIH Reporter API Integration (free, no auth)
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

function nihReq(path, body) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method: body ? 'POST' : 'GET', hostname: 'api.reporter.nih.gov', path, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'nih-reporter',
  name: 'NIH Reporter',
  category: 'health',
  icon: 'BookOpen',
  description: 'Search NIH-funded research projects, publications, and patents from NIH Reporter.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await nihReq('/v2/projects/search', { criteria: { fiscal_years: [new Date().getFullYear()] }, limit: 1 }); return { success: true, message: `NIH Reporter: ${r.meta?.total} total projects` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_projects: async (params, creds) => {
      const criteria = {};
      if (params.terms) criteria.advanced_text_search = { operator: 'and', search_field: 'all', search_text: params.terms };
      if (params.pi_names) criteria.pi_names = [{ any_name: params.pi_names }];
      if (params.org_names) criteria.org_names = [params.org_names];
      if (params.fiscal_years) criteria.fiscal_years = params.fiscal_years;
      return nihReq('/v2/projects/search', { criteria, limit: params.limit || 25, offset: params.offset || 0 });
    },
    get_project: async (params, creds) => {
      if (!params.appl_id) throw new Error('appl_id required');
      return nihReq('/v2/projects/search', { criteria: { appl_ids: [params.appl_id] } });
    },
    search_publications: async (params, creds) => {
      if (!params.appl_id && !params.project_num) throw new Error('appl_id or project_num required');
      return nihReq('/v2/publications/search', { criteria: { appl_ids: params.appl_id ? [params.appl_id] : undefined, project_nums: params.project_num ? [params.project_num] : undefined }, limit: params.limit || 25 });
    },
    search_patents: async (params, creds) => {
      if (!params.appl_id) throw new Error('appl_id required');
      return nihReq('/v2/patents/search', { criteria: { appl_ids: [params.appl_id] } });
    },
    get_spending: async (params, creds) => {
      return nihReq('/v2/projects/search', { criteria: { fiscal_years: [params.year || new Date().getFullYear()], activity_codes: params.activity_codes || ['R01'] }, limit: params.limit || 25, include_fields: ['ProjectNum', 'TotalCostAmount', 'OrgName'] });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
