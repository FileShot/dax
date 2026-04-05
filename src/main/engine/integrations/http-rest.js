// ─── HTTP / REST Integration ────────────────────────────────
// Generic HTTP client for calling any REST API
// Supports: GET, POST, PUT, PATCH, DELETE with headers, auth, body

const https = require('https');
const http = require('http');

function httpRequest(method, urlStr, headers = {}, body = null, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isSecure = url.protocol === 'https:';
    const transport = isSecure ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isSecure ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
      timeout,
    };

    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      if (!options.headers['Content-Type']) options.headers['Content-Type'] = 'application/json';
    }
    if (body) options.headers['Content-Length'] = Buffer.byteLength(body);

    const req = transport.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        let parsed = chunks;
        try { parsed = JSON.parse(chunks); } catch (_) {}
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'http-rest',
  name: 'HTTP / REST',
  category: 'utility',
  icon: 'Globe',
  description: 'Call any REST API — GET, POST, PUT, DELETE with custom headers and auth',
  configFields: [
    { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com' },
    { key: 'default_headers', label: 'Default Headers (JSON)', type: 'text', placeholder: '{"Authorization":"Bearer ..."}' },
  ],

  credentials: null,
  connected: false,

  async connect(creds) {
    // Validate base URL if provided
    if (creds.base_url) {
      new URL(creds.base_url); // throws if invalid
    }
    if (creds.default_headers) {
      JSON.parse(creds.default_headers); // throws if invalid JSON
    }
    this.credentials = creds;
    this.connected = true;
  },

  async disconnect() {
    this.connected = false;
    this.credentials = null;
  },

  async test(creds) {
    try {
      if (creds.base_url) {
        const result = await httpRequest('GET', creds.base_url, creds.default_headers ? JSON.parse(creds.default_headers) : {});
        return { success: true, message: `${creds.base_url} — HTTP ${result.status}` };
      }
      return { success: true, message: 'HTTP client configured (no base URL)' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    request: async (params, creds) => {
      const method = (params.method || 'GET').toUpperCase();
      let url = params.url;
      if (!url && creds.base_url) url = creds.base_url + (params.path || '');
      if (!url) throw new Error('URL or base_url + path required');

      // Validate URL
      new URL(url);

      const headers = {
        ...(creds.default_headers ? JSON.parse(creds.default_headers) : {}),
        ...(params.headers || {}),
      };

      const result = await httpRequest(method, url, headers, params.body, params.timeout || 30000);
      return result;
    },

    get: async (params, creds) => {
      let url = params.url || (creds.base_url + (params.path || ''));
      new URL(url);
      const headers = { ...(creds.default_headers ? JSON.parse(creds.default_headers) : {}), ...(params.headers || {}) };
      return httpRequest('GET', url, headers);
    },

    post: async (params, creds) => {
      let url = params.url || (creds.base_url + (params.path || ''));
      new URL(url);
      const headers = { ...(creds.default_headers ? JSON.parse(creds.default_headers) : {}), ...(params.headers || {}) };
      return httpRequest('POST', url, headers, params.body);
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
