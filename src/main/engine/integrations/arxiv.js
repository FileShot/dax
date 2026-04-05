/**
 * arXiv Preprint API Integration (free, no auth — Atom/JSON feed)
 */
'use strict';
const https = require('https');
const { makeRequest } = require('../../engine/integration-utils');

function parseAtomSimple(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRegex.exec(xml)) !== null) {
    const e = m[1];
    const get = (tag) => { const t = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(e); return t ? t[1].trim() : ''; };
    entries.push({ id: get('id'), title: get('title').replace(/\s+/g, ' '), summary: get('summary').replace(/\s+/g, ' '), published: get('published'), updated: get('updated'), authors: [...e.matchAll(/<author>[\s\S]*?<name>([^<]+)<\/name>/g)].map(a => a[1]) });
  }
  const totalMatch = /<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/.exec(xml);
  return { total: totalMatch ? parseInt(totalMatch[1]) : null, entries };
}

function arxivReq(qs) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: 'export.arxiv.org', path: `/api/query?${qs}`, headers: { 'Accept': 'application/atom+xml' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(parseAtomSimple(data)));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Request timeout')); });
  });
}

module.exports = {
  id: 'arxiv',
  name: 'arXiv',
  category: 'academic',
  icon: 'FileText',
  description: 'Search arXiv preprints in physics, math, CS, and more.',
  configFields: [],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await arxivReq('search_query=all:quantum&max_results=1'); return { success: true, message: 'arXiv API reachable' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const q = encodeURIComponent(params.query);
      const field = params.field || 'all';
      return arxivReq(`search_query=${field}:${q}&max_results=${params.max_results || 10}&start=${params.start || 0}&sortBy=${params.sort_by || 'relevance'}`);
    },
    get_paper: async (params, creds) => {
      if (!params.id) throw new Error('arXiv ID required (e.g. 2301.00001)');
      return arxivReq(`id_list=${params.id}`);
    },
    search_by_author: async (params, creds) => {
      if (!params.author) throw new Error('author name required');
      return arxivReq(`search_query=au:${encodeURIComponent(params.author)}&max_results=${params.max_results || 10}`);
    },
    search_recent: async (params, creds) => {
      const cat = params.category || 'cs.AI';
      return arxivReq(`search_query=cat:${cat}&max_results=${params.max_results || 10}&sortBy=submittedDate&sortOrder=descending`);
    },
    search_by_title: async (params, creds) => {
      if (!params.title) throw new Error('title required');
      return arxivReq(`search_query=ti:${encodeURIComponent(params.title)}&max_results=${params.max_results || 10}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
