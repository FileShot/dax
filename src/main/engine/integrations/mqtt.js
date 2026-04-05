/**
 * MQTT Client Integration
 */
'use strict';
const net = require('net');

module.exports = {
  id: 'mqtt',
  name: 'MQTT',
  category: 'iot',
  icon: 'Radio',
  description: 'Publish and subscribe to MQTT topics for IoT messaging.',
  configFields: [
    { key: 'host', label: 'Broker Host', type: 'text', required: true, placeholder: 'localhost' },
    { key: 'port', label: 'Port', type: 'text', required: false, placeholder: '1883' },
    { key: 'username', label: 'Username', type: 'text', required: false },
    { key: 'password', label: 'Password', type: 'password', required: false },
  ],
  async connect(creds) { if (!creds.host) throw new Error('Broker host required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    return new Promise((resolve) => {
      const port = parseInt(creds.port) || 1883;
      const socket = net.createConnection({ host: creds.host, port, timeout: 5000 }, () => {
        socket.destroy();
        resolve({ success: true, message: `Connected to ${creds.host}:${port}` });
      });
      socket.on('error', (e) => resolve({ success: false, message: e.message }));
      socket.on('timeout', () => { socket.destroy(); resolve({ success: false, message: 'Connection timeout' }); });
    });
  },
  actions: {
    publish: async (params, creds) => {
      if (!params.topic || params.message === undefined) throw new Error('topic and message required');
      return new Promise((resolve, reject) => {
        const port = parseInt(creds.port) || 1883;
        const socket = net.createConnection({ host: creds.host, port, timeout: 10000 }, () => {
          // MQTT CONNECT packet
          const clientId = `dax_${Date.now()}`;
          const connectPacket = buildMqttConnect(clientId, creds.username, creds.password);
          socket.write(connectPacket);
          const msg = String(params.message);
          const topic = params.topic;
          // Wait for CONNACK, then publish
          socket.once('data', () => {
            const publishPacket = buildMqttPublish(topic, msg);
            socket.write(publishPacket);
            setTimeout(() => { socket.destroy(); resolve({ success: true, topic, message: msg }); }, 100);
          });
        });
        socket.on('error', reject);
        socket.on('timeout', () => { socket.destroy(); reject(new Error('Timeout')); });
      });
    },
    test_connection: async (params, creds) => {
      return new Promise((resolve) => {
        const port = parseInt(creds.port) || 1883;
        const socket = net.createConnection({ host: creds.host, port, timeout: 5000 }, () => {
          socket.destroy();
          resolve({ success: true, host: creds.host, port });
        });
        socket.on('error', (e) => resolve({ success: false, message: e.message }));
        socket.on('timeout', () => { socket.destroy(); resolve({ success: false, message: 'Timeout' }); });
      });
    },
    get_info: async (params, creds) => ({ host: creds.host, port: parseInt(creds.port) || 1883, username: creds.username ? '***' : 'none' }),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};

function buildMqttConnect(clientId, username, password) {
  const protocolName = Buffer.from([0x00, 0x04, 0x4D, 0x51, 0x54, 0x54]);
  const protocolLevel = Buffer.from([0x04]);
  let connectFlags = 0x02; // Clean session
  if (username) connectFlags |= 0x80;
  if (password) connectFlags |= 0x40;
  const keepAlive = Buffer.from([0x00, 0x3C]); // 60 seconds
  const clientIdBuf = encodeUtf8(clientId);
  const parts = [protocolName, protocolLevel, Buffer.from([connectFlags]), keepAlive, clientIdBuf];
  if (username) parts.push(encodeUtf8(username));
  if (password) parts.push(encodeUtf8(password));
  const payload = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x10]), encodeLength(payload.length), payload]);
}

function buildMqttPublish(topic, message) {
  const topicBuf = encodeUtf8(topic);
  const msgBuf = Buffer.from(message, 'utf8');
  const payload = Buffer.concat([topicBuf, msgBuf]);
  return Buffer.concat([Buffer.from([0x30]), encodeLength(payload.length), payload]);
}

function encodeUtf8(str) {
  const buf = Buffer.from(str, 'utf8');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(buf.length);
  return Buffer.concat([len, buf]);
}

function encodeLength(len) {
  const bytes = [];
  do { let b = len % 128; len = Math.floor(len / 128); if (len > 0) b |= 0x80; bytes.push(b); } while (len > 0);
  return Buffer.from(bytes);
}
