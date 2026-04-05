/**
 * Prismic Headless CMS API Integration
 */
'use strict';
const { makeRequest } = require('../../engine/integration-utils');

async function prismicReq(method, repo, path, body, creds) {
  const bodyStr = body ? JSON.stringify(body) : null;
  const hostname = `${repo}.cdn.prismic.io`;
  const token = creds.access_token ? `&access_token=${encodeURIComponent(creds.access_token)}` : '';
  const opts = { method, hostname, path: `/api/v2${path}${path.includes('?') ? token.replace('&', '&') : '?' + token.slice(1)}`, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

async function getMasterRef(repo, creds) {
  const r = await prismicReq('GET', repo, '/', null, creds);
  const master = r.refs?.find(ref => ref.isMasterRef);
  return master ? master.ref : null;
}

module.exports = {
  id: 'prismic',
  name: 'Prismic',
  category: 'cms',
  icon: 'FileText',
  description: 'Query documents and content types in your Prismic repository.',
  configFields: [
    { key: 'repository', label: 'Repository Name', type: 'string', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: false, description: 'Required for private repositories' },
  ],
  async connect(creds) { if (!creds.repository) throw new Error('repository required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await prismicReq('GET', creds.repository, '/', null, creds); return { success: true, message: `Connected — ${r.refs?.length ?? 0} ref(s)` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_documents: async (params, creds) => {
      const ref = await getMasterRef(creds.repository, creds);
      const q = params.type ? `&q=[[at(document.type,"${params.type}")]]` : '';
      return prismicReq('GET', creds.repository, `/documents/search?ref=${encodeURIComponent(ref)}&pageSize=${params.page_size || 20}&page=${params.page || 1}${q}`, null, creds);
    },
    get_document_by_uid: async (params, creds) => {
      if (!params.type || !params.uid) throw new Error('type and uid required');
      const ref = await getMasterRef(creds.repository, creds);
      return prismicReq('GET', creds.repository, `/documents/search?ref=${encodeURIComponent(ref)}&q=[[at(my.${params.type}.uid,"${params.uid}")]]`, null, creds);
    },
    search_documents: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const ref = await getMasterRef(creds.repository, creds);
      return prismicReq('GET', creds.repository, `/documents/search?ref=${encodeURIComponent(ref)}&q=${encodeURIComponent(params.query)}&pageSize=${params.page_size || 20}`, null, creds);
    },
    get_api_info: async (params, creds) => prismicReq('GET', creds.repository, '/', null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
