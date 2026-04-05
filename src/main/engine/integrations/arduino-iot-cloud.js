/**
 * Arduino IoT Cloud Integration
 */
'use strict';
const https = require('https');

async function getArduinoToken(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, audience: 'https://api2.arduino.cc/iot' }).toString();
    const opts = {
      method: 'POST', hostname: 'api2.arduino.cc', path: '/iot/v1/clients/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    };
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

function arduinoReq(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname: 'api2.arduino.cc', path: `/iot/v2${path}`,
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
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
  id: 'arduino-iot-cloud',
  name: 'Arduino IoT Cloud',
  category: 'iot',
  icon: 'CircuitBoard',
  description: 'Manage Arduino IoT Cloud devices, things, and properties.',
  configFields: [
    { key: 'client_id', label: 'Client ID', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('Client ID and secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const t = await getArduinoToken(creds.client_id, creds.client_secret);
      if (t.error) return { success: false, message: t.error_description || t.error };
      return { success: true, message: 'Connected to Arduino IoT Cloud' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  async _token(creds) { const t = await getArduinoToken(creds.client_id, creds.client_secret); if (t.error) throw new Error(t.error_description || t.error); return t.access_token; },
  actions: {
    list_devices: async (_params, creds) => {
      const token = await module.exports._token(creds);
      return arduinoReq('GET', '/devices', token);
    },
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      const token = await module.exports._token(creds);
      return arduinoReq('GET', `/devices/${params.device_id}`, token);
    },
    list_things: async (_params, creds) => {
      const token = await module.exports._token(creds);
      return arduinoReq('GET', '/things', token);
    },
    get_thing_properties: async (params, creds) => {
      if (!params.thing_id) throw new Error('thing_id required');
      const token = await module.exports._token(creds);
      return arduinoReq('GET', `/things/${params.thing_id}/properties`, token);
    },
    set_property: async (params, creds) => {
      if (!params.thing_id || !params.property_id || params.value === undefined) throw new Error('thing_id, property_id, and value required');
      const token = await module.exports._token(creds);
      return arduinoReq('PUT', `/things/${params.thing_id}/properties/${params.property_id}/publish`, token, { value: params.value });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
