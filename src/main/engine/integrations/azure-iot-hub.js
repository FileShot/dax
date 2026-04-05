/**
 * Azure IoT Hub Integration
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function generateSasToken(resourceUri, key, policyName, expirySeconds) {
  const expiry = Math.floor(Date.now() / 1000) + (expirySeconds || 3600);
  const encoded = encodeURIComponent(resourceUri);
  const strToSign = `${encoded}\n${expiry}`;
  const sig = crypto.createHmac('sha256', Buffer.from(key, 'base64')).update(strToSign).digest('base64');
  return `SharedAccessSignature sr=${encoded}&sig=${encodeURIComponent(sig)}&se=${expiry}${policyName ? '&skn=' + policyName : ''}`;
}

function iotHubReq(method, hostname, path, sasToken, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const opts = {
      method, hostname, path,
      headers: { 'Authorization': sasToken, 'Accept': 'application/json', 'Content-Type': 'application/json', ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }) }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (!data) return resolve({ status: res.statusCode });
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = {
  id: 'azure-iot-hub',
  name: 'Azure IoT Hub',
  category: 'iot',
  icon: 'Server',
  description: 'Manage Azure IoT Hub devices, send messages, and invoke direct methods.',
  configFields: [
    { key: 'hostname', label: 'IoT Hub Hostname', type: 'text', required: true, placeholder: 'myhub.azure-devices.net' },
    { key: 'shared_access_key', label: 'Shared Access Key', type: 'password', required: true },
    { key: 'policy_name', label: 'Policy Name', type: 'text', required: false, placeholder: 'iothubowner' },
  ],
  async connect(creds) { if (!creds.hostname || !creds.shared_access_key) throw new Error('Hostname and shared access key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try {
      const token = generateSasToken(creds.hostname, creds.shared_access_key, creds.policy_name || 'iothubowner');
      const r = await iotHubReq('GET', creds.hostname, '/devices?top=1&api-version=2021-04-12', token);
      if (r.Message) return { success: false, message: r.Message };
      return { success: true, message: 'Connected to Azure IoT Hub' };
    } catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_devices: async (params, creds) => {
      const token = generateSasToken(creds.hostname, creds.shared_access_key, creds.policy_name || 'iothubowner');
      return iotHubReq('GET', creds.hostname, `/devices?top=${params.top || 20}&api-version=2021-04-12`, token);
    },
    get_device: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      const token = generateSasToken(creds.hostname, creds.shared_access_key, creds.policy_name || 'iothubowner');
      return iotHubReq('GET', creds.hostname, `/devices/${encodeURIComponent(params.device_id)}?api-version=2021-04-12`, token);
    },
    get_device_twin: async (params, creds) => {
      if (!params.device_id) throw new Error('device_id required');
      const token = generateSasToken(creds.hostname, creds.shared_access_key, creds.policy_name || 'iothubowner');
      return iotHubReq('GET', creds.hostname, `/twins/${encodeURIComponent(params.device_id)}?api-version=2021-04-12`, token);
    },
    invoke_method: async (params, creds) => {
      if (!params.device_id || !params.method_name) throw new Error('device_id and method_name required');
      const token = generateSasToken(creds.hostname, creds.shared_access_key, creds.policy_name || 'iothubowner');
      return iotHubReq('POST', creds.hostname, `/twins/${encodeURIComponent(params.device_id)}/methods?api-version=2021-04-12`, token, { methodName: params.method_name, payload: params.payload || {}, responseTimeoutInSeconds: 30, connectTimeoutInSeconds: 30 });
    },
    send_c2d_message: async (params, creds) => {
      if (!params.device_id || !params.message) throw new Error('device_id and message required');
      const token = generateSasToken(creds.hostname, creds.shared_access_key, creds.policy_name || 'iothubowner');
      return iotHubReq('POST', creds.hostname, `/devices/${encodeURIComponent(params.device_id)}/messages/devicebound?api-version=2021-04-12`, token, params.message);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
