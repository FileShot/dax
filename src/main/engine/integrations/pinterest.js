/**
 * Pinterest API v5 Integration
 */
'use strict';
const https = require('https');

function pinterestReq(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = { method, hostname: 'api.pinterest.com', path: `/v5${path}`, headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) } };
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
  id: 'pinterest',
  name: 'Pinterest',
  category: 'social',
  icon: 'Image',
  description: 'Manage Pinterest boards, pins, and account data via the Pinterest API v5.',
  configFields: [{ key: 'access_token', label: 'Access Token (OAuth2)', type: 'password', required: true }],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await pinterestReq('GET', '/user_account', creds.access_token); if (r.code) return { success: false, message: r.message || 'Auth failed' }; return { success: true, message: `Connected as ${r.username}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_user: async (_p, creds) => pinterestReq('GET', '/user_account', creds.access_token),
    list_boards: async (params, creds) => {
      const qs = new URLSearchParams({ page_size: String(params.page_size || 25), ...(params.bookmark && { bookmark: params.bookmark }) }).toString();
      return pinterestReq('GET', `/boards?${qs}`, creds.access_token);
    },
    get_board: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      return pinterestReq('GET', `/boards/${params.board_id}`, creds.access_token);
    },
    list_pins: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      const qs = new URLSearchParams({ page_size: String(params.page_size || 25), ...(params.bookmark && { bookmark: params.bookmark }) }).toString();
      return pinterestReq('GET', `/boards/${params.board_id}/pins?${qs}`, creds.access_token);
    },
    get_pin: async (params, creds) => {
      if (!params.pin_id) throw new Error('pin_id required');
      return pinterestReq('GET', `/pins/${params.pin_id}`, creds.access_token);
    },
    create_board: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return pinterestReq('POST', '/boards', creds.access_token, { name: params.name, ...(params.description && { description: params.description }), privacy: params.privacy || 'PUBLIC' });
    },
    create_pin: async (params, creds) => {
      if (!params.board_id || !params.image_url) throw new Error('board_id and image_url required');
      return pinterestReq('POST', '/pins', creds.access_token, { board_id: params.board_id, media_source: { source_type: 'image_url', url: params.image_url }, ...(params.title && { title: params.title }), ...(params.description && { description: params.description }), ...(params.link && { link: params.link }) });
    },
    delete_pin: async (params, creds) => {
      if (!params.pin_id) throw new Error('pin_id required');
      return pinterestReq('DELETE', `/pins/${params.pin_id}`, creds.access_token);
    },
    update_board: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.description) body.description = params.description;
      return pinterestReq('PATCH', `/boards/${params.board_id}`, creds.access_token, body);
    },
    get_pin_analytics: async (params, creds) => {
      if (!params.pin_id) throw new Error('pin_id required');
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const end = params.end_date || new Date().toISOString().slice(0, 10);
      const metrics = params.metric_types || 'IMPRESSION,ENGAGEMENT,PIN_CLICK';
      return pinterestReq('GET', `/pins/${params.pin_id}/analytics?start_date=${start}&end_date=${end}&metric_types=${encodeURIComponent(metrics)}`, creds.access_token);
    },
    list_board_sections: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      return pinterestReq('GET', `/boards/${params.board_id}/sections`, creds.access_token);
    },
    get_user_analytics: async (params, creds) => {
      const start = params.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const end = params.end_date || new Date().toISOString().slice(0, 10);
      const metrics = params.metric_types || 'ENGAGEMENT,IMPRESSION,PIN_CLICK,SAVE';
      return pinterestReq('GET', `/user_account/analytics?start_date=${start}&end_date=${end}&metric_types=${encodeURIComponent(metrics)}`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
