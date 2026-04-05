/**
 * Integration Template — Copy this file to create a new integration.
 *
 * Required exports:
 *   id           — unique string identifier (lowercase, hyphens ok)
 *   name         — display name
 *   category     — one of: communication, productivity, development, cloud, database, utility, social, commerce, ai
 *   icon         — lucide-react icon name (see https://lucide.dev/icons)
 *   description  — short description (1-2 sentences)
 *   configFields — array of credential/config fields the user fills in
 *   connect()    — validate credentials (throw on failure)
 *   disconnect() — cleanup (optional)
 *   test()       — return { success: boolean, message: string }
 *   actions      — object mapping action names to async handler functions
 *   executeAction() — router that calls the correct action handler
 */

'use strict';

const https = require('https');

// ─── Helper: HTTPS JSON request ──────────────────────────────
function apiRequest(method, hostname, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname, path, headers: { 'Content-Type': 'application/json', ...headers } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  // ─── Metadata ──────────────────────────────────────────────
  id: 'my-integration',
  name: 'My Integration',
  category: 'utility',
  icon: 'Puzzle',
  description: 'Description of what this integration does.',

  // ─── Configuration Fields ──────────────────────────────────
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: true },
    { key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://api.example.com' },
  ],

  // ─── Lifecycle ─────────────────────────────────────────────
  async connect(creds) {
    if (!creds.api_key) throw new Error('API key is required');
    // Validate credentials by making a test API call
    this.credentials = creds;
  },

  async disconnect() {
    this.credentials = null;
  },

  async test(creds) {
    try {
      // Make a lightweight API call to verify credentials
      return { success: true, message: 'Connected successfully' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ─── Actions ───────────────────────────────────────────────
  actions: {
    example_action: async (params, creds) => {
      // params — user-provided parameters for this action
      // creds — credentials from connect()
      return { result: 'done' };
    },
  },

  // ─── Action Router ─────────────────────────────────────────
  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
