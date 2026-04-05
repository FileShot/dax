/**
 * Docker Engine API Integration (local Docker daemon)
 */
'use strict';
const http = require('http');
const path = require('path');
const net = require('net');

function dockerApi(method, urlPath, body = null, socketPath = null) {
  const sock = socketPath || (process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock');
  return new Promise((resolve, reject) => {
    const opts = { method, socketPath: sock, path: `/v1.43${urlPath}`, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data, statusCode: res.statusCode }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'docker',
  name: 'Docker',
  category: 'devops',
  icon: 'Container',
  description: 'Manage Docker containers, images, and volumes on the local daemon.',
  configFields: [
    { key: 'socket_path', label: 'Docker Socket Path (auto-detected if empty)', type: 'text', required: false },
  ],
  async connect(creds) { this.credentials = creds || {}; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await dockerApi('GET', '/version', null, creds?.socket_path); return { success: !!r.Version, message: r.Version ? `Docker ${r.Version}` : 'Cannot connect' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_containers: async (params, creds) => {
      const all = params.all ? '?all=true' : '';
      return dockerApi('GET', `/containers/json${all}`, null, creds?.socket_path);
    },
    inspect_container: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      return dockerApi('GET', `/containers/${params.container_id}/json`, null, creds?.socket_path);
    },
    start_container: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      return dockerApi('POST', `/containers/${params.container_id}/start`, null, creds?.socket_path);
    },
    stop_container: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      return dockerApi('POST', `/containers/${params.container_id}/stop`, null, creds?.socket_path);
    },
    restart_container: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      return dockerApi('POST', `/containers/${params.container_id}/restart`, null, creds?.socket_path);
    },
    list_images: async (params, creds) => dockerApi('GET', '/images/json', null, creds?.socket_path),
    container_logs: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      const tail = params.tail || 100;
      return dockerApi('GET', `/containers/${params.container_id}/logs?stdout=true&stderr=true&tail=${tail}`, null, creds?.socket_path);
    },
    system_info: async (params, creds) => dockerApi('GET', '/info', null, creds?.socket_path),
    create_container: async (params, creds) => {
      if (!params.image) throw new Error('image required');
      const body = { Image: params.image, ...(params.name && { name: params.name }), ...(params.env && { Env: params.env }), ...(params.ports && { ExposedPorts: params.ports }) };
      const qs = params.name ? `?name=${encodeURIComponent(params.name)}` : '';
      return dockerApi('POST', `/containers/create${qs}`, body, creds?.socket_path);
    },
    remove_container: async (params, creds) => {
      if (!params.container_id) throw new Error('container_id required');
      const force = params.force ? '?force=true' : '';
      return dockerApi('DELETE', `/containers/${params.container_id}${force}`, null, creds?.socket_path);
    },
    pull_image: async (params, creds) => {
      if (!params.image) throw new Error('image required');
      return dockerApi('POST', `/images/create?fromImage=${encodeURIComponent(params.image)}&tag=${params.tag || 'latest'}`, null, creds?.socket_path);
    },
    list_volumes: async (params, creds) => dockerApi('GET', '/volumes', null, creds?.socket_path),
    list_networks: async (params, creds) => dockerApi('GET', '/networks', null, creds?.socket_path),
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
