/**
 * Mastodon API Integration
 */
'use strict';
const https = require('https');

function mastodonApi(method, instanceUrl, path, token, body = null) {
  const url = new URL(`${instanceUrl}/api/v1${path}`);
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
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
  id: 'mastodon',
  name: 'Mastodon',
  category: 'social',
  icon: 'MessageCircle',
  description: 'Post toots, read timelines, and interact on any Mastodon instance.',
  configFields: [
    { key: 'instance_url', label: 'Instance URL (e.g. https://mastodon.social)', type: 'text', required: true },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.instance_url || !creds.access_token) throw new Error('Instance URL and access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mastodonApi('GET', creds.instance_url, '/accounts/verify_credentials', creds.access_token); return { success: !!r.id, message: r.id ? `Authenticated as @${r.username}` : `Error: ${r.error || 'Unknown'}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    post_status: async (params, creds) => {
      if (!params.text) throw new Error('text required');
      const body = { status: params.text };
      if (params.visibility) body.visibility = params.visibility; // public, unlisted, private, direct
      if (params.spoiler_text) body.spoiler_text = params.spoiler_text;
      if (params.in_reply_to_id) body.in_reply_to_id = params.in_reply_to_id;
      return mastodonApi('POST', creds.instance_url, '/statuses', creds.access_token, body);
    },
    get_timeline: async (params, creds) => {
      const type = params.type || 'home'; // home, public, local
      const limit = params.limit || 20;
      const path = type === 'local' ? `/timelines/public?local=true&limit=${limit}` : `/timelines/${type}?limit=${limit}`;
      return mastodonApi('GET', creds.instance_url, path, creds.access_token);
    },
    search: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const type = params.type || ''; // accounts, hashtags, statuses
      const limit = params.limit || 20;
      const url = new URL(`${creds.instance_url}/api/v2/search`);
      url.searchParams.set('q', params.query);
      url.searchParams.set('limit', limit);
      if (type) url.searchParams.set('type', type);
      return new Promise((resolve, reject) => {
        const req = https.request({ method: 'GET', hostname: url.hostname, path: `${url.pathname}${url.search}`, headers: { 'Authorization': `Bearer ${creds.access_token}` } }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
        });
        req.on('error', reject);
        req.end();
      });
    },
    get_notifications: async (params, creds) => {
      const limit = params.limit || 20;
      return mastodonApi('GET', creds.instance_url, `/notifications?limit=${limit}`, creds.access_token);
    },
    follow: async (params, creds) => {
      if (!params.account_id) throw new Error('account_id required');
      return mastodonApi('POST', creds.instance_url, `/accounts/${params.account_id}/follow`, creds.access_token);
    },
    boost: async (params, creds) => {
      if (!params.status_id) throw new Error('status_id required');
      return mastodonApi('POST', creds.instance_url, `/statuses/${params.status_id}/reblog`, creds.access_token);
    },
    favourite: async (params, creds) => {
      if (!params.status_id) throw new Error('status_id required');
      return mastodonApi('POST', creds.instance_url, `/statuses/${params.status_id}/favourite`, creds.access_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
