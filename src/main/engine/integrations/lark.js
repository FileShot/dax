/**
 * Lark (Feishu) API Integration by ByteDance
 */
'use strict';
const { TokenCache, makeRequest } = require('../../engine/integration-utils');

const _tokenCache = new TokenCache(7000);

async function getToken(creds) {
  const key = `lark:${creds.app_id}`;
  if (_tokenCache.get(key)) return _tokenCache.get(key);
  const body = JSON.stringify({ app_id: creds.app_id, app_secret: creds.app_secret });
  const opts = { method: 'POST', hostname: 'open.larksuite.com', path: '/open-apis/auth/v3/app_access_token/internal', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
  const r = await makeRequest(opts, body);
  _tokenCache.set(key, r.app_access_token);
  return r.app_access_token;
}

async function larkReq(method, path, body, creds) {
  const token = await getToken(creds);
  const bodyStr = body ? JSON.stringify(body) : null;
  const opts = { method, hostname: 'open.larksuite.com', path: `/open-apis${path}`, headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(bodyStr && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }) } };
  return makeRequest(opts, bodyStr);
}

module.exports = {
  id: 'lark',
  name: 'Lark',
  category: 'communication',
  icon: 'MessageSquare',
  description: 'Send messages, manage chats, and access docs in Lark (Feishu) by ByteDance.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
    { key: 'app_secret', label: 'App Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.app_secret) throw new Error('app_id and app_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds); return { success: true, message: `App token obtained for ${creds.app_id}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    send_message: async (params, creds) => {
      if (!params.receive_id || !params.content) throw new Error('receive_id and content required');
      return larkReq('POST', `/im/v1/messages?receive_id_type=${params.receive_id_type || 'chat_id'}`, { receive_id: params.receive_id, msg_type: params.msg_type || 'text', content: JSON.stringify(typeof params.content === 'string' ? { text: params.content } : params.content) }, creds);
    },
    list_chats: async (params, creds) => larkReq('GET', `/im/v1/chats?page_size=${params.page_size || 25}`, null, creds),
    list_messages: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      return larkReq('GET', `/im/v1/messages?container_id_type=${params.id_type || 'chat'}&container_id=${params.container_id}&page_size=${params.page_size || 25}`, null, creds);
    },
    get_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      return larkReq('GET', `/contact/v3/users/${params.user_id}`, null, creds);
    },
    list_drive_files: async (params, creds) => larkReq('GET', `/drive/v1/files?folder_token=${params.folder_token || ''}&page_size=${params.page_size || 25}`, null, creds),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
