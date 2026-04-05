/**
 * ThingSpeak IoT Data Platform Integration
 */
'use strict';
const https = require('https');

function tsGet(path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: 'api.thingspeak.com', path, headers: { 'Accept': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function tsWrite(channelId, apiKey, data) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams({ api_key: apiKey, ...data }).toString();
    const opts = {
      method: 'POST', hostname: 'api.thingspeak.com', path: `/update?${qs}`,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': 0 }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ entry_id: parseInt(d) || d }));
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'thingspeak',
  name: 'ThingSpeak',
  category: 'iot',
  icon: 'Radio',
  description: 'Read and write IoT sensor data to ThingSpeak channels.',
  configFields: [
    { key: 'channel_id', label: 'Channel ID', type: 'text', required: true },
    { key: 'read_api_key', label: 'Read API Key', type: 'password', required: false },
    { key: 'write_api_key', label: 'Write API Key', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.channel_id) throw new Error('Channel ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const path = `/channels/${creds.channel_id}/feeds/last.json${creds.read_api_key ? '?api_key=' + creds.read_api_key : ''}`;
      const r = await tsGet(path);
      if (r.error || r.status === '404') return { success: false, message: r.error || 'Channel not found' };
      return { success: true, message: `Connected to channel ${creds.channel_id}` };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    read_channel_feed: async (params, creds) => {
      const channelId = params.channel_id || creds.channel_id;
      const qs = new URLSearchParams({ results: String(params.results || 10), ...(creds.read_api_key && { api_key: creds.read_api_key }) }).toString();
      return tsGet(`/channels/${channelId}/feeds.json?${qs}`);
    },
    get_last_entry: async (params, creds) => {
      const channelId = params.channel_id || creds.channel_id;
      const qs = creds.read_api_key ? `?api_key=${creds.read_api_key}` : '';
      return tsGet(`/channels/${channelId}/feeds/last.json${qs}`);
    },
    get_field_feed: async (params, creds) => {
      if (!params.field_number) throw new Error('field_number required (1-8)');
      const channelId = params.channel_id || creds.channel_id;
      const qs = new URLSearchParams({ results: String(params.results || 10), ...(creds.read_api_key && { api_key: creds.read_api_key }) }).toString();
      return tsGet(`/channels/${channelId}/fields/${params.field_number}.json?${qs}`);
    },
    write_data: async (params, creds) => {
      if (!creds.write_api_key) throw new Error('write_api_key required');
      const fields = {};
      for (let i = 1; i <= 8; i++) { if (params[`field${i}`] !== undefined) fields[`field${i}`] = String(params[`field${i}`]); }
      return tsWrite(creds.channel_id, creds.write_api_key, fields);
    },
    list_channels: async (_params, creds) => {
      const qs = creds.read_api_key ? `?api_key=${creds.read_api_key}` : '';
      return tsGet(`/channels/${creds.channel_id}.json${qs}`);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
