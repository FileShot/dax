/**
 * Redis (Upstash REST API) Integration
 */
'use strict';
const https = require('https');

function redisApi(url, token, command) {
  const parsed = new URL(url);
  const path = '/' + command.map((c) => encodeURIComponent(c)).join('/');
  return new Promise((resolve, reject) => {
    const opts = { method: 'GET', hostname: parsed.hostname, path, headers: { 'Authorization': `Bearer ${token}` } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function redisPipeline(url, token, commands) {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(commands);
    const opts = { method: 'POST', hostname: parsed.hostname, path: '/pipeline', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'redis',
  name: 'Redis (Upstash)',
  category: 'data',
  icon: 'Zap',
  description: 'Execute Redis commands via Upstash REST API.',
  configFields: [
    { key: 'url', label: 'Upstash REST URL', type: 'text', required: true },
    { key: 'token', label: 'REST Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.url || !creds.token) throw new Error('URL and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await redisApi(creds.url, creds.token, ['PING']); return { success: r.result === 'PONG', message: r.result === 'PONG' ? 'Connected' : `Unexpected: ${JSON.stringify(r)}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get: async (params, creds) => { if (!params.key) throw new Error('key required'); return redisApi(creds.url, creds.token, ['GET', params.key]); },
    set: async (params, creds) => {
      if (!params.key || params.value === undefined) throw new Error('key and value required');
      const cmd = ['SET', params.key, String(params.value)];
      if (params.ex) cmd.push('EX', String(params.ex));
      return redisApi(creds.url, creds.token, cmd);
    },
    del: async (params, creds) => { if (!params.key) throw new Error('key required'); return redisApi(creds.url, creds.token, ['DEL', params.key]); },
    keys: async (params, creds) => redisApi(creds.url, creds.token, ['KEYS', params.pattern || '*']),
    hgetall: async (params, creds) => { if (!params.key) throw new Error('key required'); return redisApi(creds.url, creds.token, ['HGETALL', params.key]); },
    hset: async (params, creds) => {
      if (!params.key || !params.field || params.value === undefined) throw new Error('key, field, and value required');
      return redisApi(creds.url, creds.token, ['HSET', params.key, params.field, String(params.value)]);
    },
    lpush: async (params, creds) => { if (!params.key || !params.value) throw new Error('key and value required'); return redisApi(creds.url, creds.token, ['LPUSH', params.key, String(params.value)]); },
    lrange: async (params, creds) => { if (!params.key) throw new Error('key required'); return redisApi(creds.url, creds.token, ['LRANGE', params.key, String(params.start || 0), String(params.stop || -1)]); },
    pipeline: async (params, creds) => {
      if (!params.commands || !Array.isArray(params.commands)) throw new Error('commands array required');
      return redisPipeline(creds.url, creds.token, params.commands);
    },
    incr: async (params, creds) => { if (!params.key) throw new Error('key required'); return redisApi(creds.url, creds.token, ['INCR', params.key]); },
    expire: async (params, creds) => { if (!params.key || !params.seconds) throw new Error('key and seconds required'); return redisApi(creds.url, creds.token, ['EXPIRE', params.key, String(params.seconds)]); },
    ttl: async (params, creds) => { if (!params.key) throw new Error('key required'); return redisApi(creds.url, creds.token, ['TTL', params.key]); },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
