/**
 * Agora Real-Time Communications REST API Integration
 */
'use strict';
const https = require('https');

function agoraRequest(method, path, body, appId, appCertificate) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${appId}:${appCertificate}`).toString('base64');
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { method, hostname: 'api.agora.io', path, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
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
  id: 'agora',
  name: 'Agora',
  category: 'gaming',
  icon: 'Radio',
  description: 'Manage real-time voice/video channels and users via the Agora RESTful API.',
  configFields: [
    { key: 'app_id', label: 'App ID', type: 'text', required: true },
    { key: 'app_certificate', label: 'App Certificate / Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.app_id || !creds.app_certificate) throw new Error('App ID and App Certificate required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await agoraRequest('GET', `/dev/v1/channel/appid/${creds.app_id}`, null, creds.app_id, creds.app_certificate); return { success: r.success === true || !!r.data, message: r.message || 'Connected to Agora' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_channels: async (params, creds) => {
      const qs = `?page_no=${params.page_no || 0}&page_size=${params.page_size || 20}`;
      return agoraRequest('GET', `/dev/v1/channel/appid/${creds.app_id}${qs}`, null, creds.app_id, creds.app_certificate);
    },
    get_channel_user_list: async (params, creds) => {
      if (!params.channel_name) throw new Error('channel_name required');
      return agoraRequest('GET', `/dev/v1/channel/user/${creds.app_id}/${params.channel_name}`, null, creds.app_id, creds.app_certificate);
    },
    ban_user_in_channel: async (params, creds) => {
      if (!params.uid || !params.channel_name) throw new Error('uid and channel_name required');
      const body = { ip: params.ip, uid: params.uid, cname: params.channel_name, time: params.time || 60 };
      return agoraRequest('POST', '/dev/v1/kicking-rule', body, creds.app_id, creds.app_certificate);
    },
    get_ban_rules: async (params, creds) => {
      return agoraRequest('GET', '/dev/v1/kicking-rule', null, creds.app_id, creds.app_certificate);
    },
    update_ban_rule: async (params, creds) => {
      if (!params.id || params.time === undefined) throw new Error('id and time required');
      return agoraRequest('PUT', '/dev/v1/kicking-rule', { id: params.id, time: params.time }, creds.app_id, creds.app_certificate);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
