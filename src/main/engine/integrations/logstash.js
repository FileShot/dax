/**
 * Logstash Monitoring API Integration
 */
'use strict';
const http = require('http');
const https = require('https');

function logstashApi(host, port, useTls, path) {
  return new Promise((resolve, reject) => {
    const lib = useTls ? https : http;
    const opts = { method: 'GET', hostname: host, port: port || 9600, path, headers: { 'Accept': 'application/json' } };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'logstash',
  name: 'Logstash',
  category: 'logging',
  icon: 'Activity',
  description: 'Monitor Logstash pipelines and node stats via the monitoring API.',
  configFields: [
    { key: 'host', label: 'Logstash Host', type: 'text', required: true, placeholder: 'localhost' },
    { key: 'port', label: 'Monitoring API Port', type: 'number', required: false, placeholder: '9600' },
    { key: 'use_tls', label: 'Use TLS', type: 'boolean', required: false },
  ],
  async connect(creds) { if (!creds.host) throw new Error('Host required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await logstashApi(creds.host, creds.port, creds.use_tls, '/'); return { success: !!r.status, message: `Logstash ${r.version} — ${r.status}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    node_info: async (params, creds) => logstashApi(creds.host, creds.port, creds.use_tls, '/?pretty'),
    node_stats: async (params, creds) => logstashApi(creds.host, creds.port, creds.use_tls, '/_node/stats?pretty'),
    pipeline_stats: async (params, creds) => {
      const path = params.pipeline_id ? `/_node/stats/pipelines/${params.pipeline_id}?pretty` : '/_node/stats/pipelines?pretty';
      return logstashApi(creds.host, creds.port, creds.use_tls, path);
    },
    hot_threads: async (params, creds) => logstashApi(creds.host, creds.port, creds.use_tls, '/_node/hot_threads?pretty'),
    jvm_stats: async (params, creds) => logstashApi(creds.host, creds.port, creds.use_tls, '/_node/stats/jvm?pretty'),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
