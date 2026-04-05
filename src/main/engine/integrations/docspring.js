/**
 * DocSpring PDF Generation & Template API Integration
 */
'use strict';
const https = require('https');

function docspringReq(method, path, tokenId, tokenSecret, body) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'api.docspring.com', path: `/api/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'docspring',
  name: 'DocSpring',
  category: 'legal',
  icon: 'FileText',
  description: 'Generate PDFs from templates and manage document submissions via DocSpring.',
  configFields: [
    { key: 'token_id', label: 'Token ID', type: 'text', required: true },
    { key: 'token_secret', label: 'Token Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.token_id || !creds.token_secret) throw new Error('Token ID and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await docspringReq('GET', '/templates', creds.token_id, creds.token_secret); if (r.error) return { success: false, message: r.error }; return { success: true, message: 'Connected to DocSpring' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_templates: async (params, creds) => {
      const qs = new URLSearchParams({ page: String(params.page || 1), per_page: String(params.per_page || 20) }).toString();
      return docspringReq('GET', `/templates?${qs}`, creds.token_id, creds.token_secret);
    },
    get_template: async (params, creds) => {
      if (!params.template_id) throw new Error('template_id required');
      return docspringReq('GET', `/templates/${params.template_id}`, creds.token_id, creds.token_secret);
    },
    generate_pdf: async (params, creds) => {
      if (!params.template_id || !params.data) throw new Error('template_id and data object required');
      return docspringReq('POST', `/templates/${params.template_id}/submissions`, creds.token_id, creds.token_secret, { data: params.data, metadata: params.metadata || {}, test: params.test !== false });
    },
    get_submission: async (params, creds) => {
      if (!params.submission_id) throw new Error('submission_id required');
      return docspringReq('GET', `/submissions/${params.submission_id}`, creds.token_id, creds.token_secret);
    },
    merge_pdfs: async (params, creds) => {
      if (!Array.isArray(params.submission_ids) || params.submission_ids.length < 2) throw new Error('submission_ids array with at least 2 IDs required');
      return docspringReq('POST', '/combined_submissions', creds.token_id, creds.token_secret, { source_pdfs: params.submission_ids.map(id => ({ type: 'submission', id })) });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
