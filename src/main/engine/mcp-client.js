// ─── MCP Client ─────────────────────────────────────────────
// Model Context Protocol client for connecting to external MCP servers.
// Supports stdio transport (spawn a process) and SSE transport (HTTP).
// MCP spec: https://modelcontextprotocol.io

const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');

class McpClient extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || `mcp_${Date.now()}`;
    this.name = config.name || 'Unknown MCP Server';
    this.transport = config.transport || 'stdio'; // 'stdio' | 'sse'
    this.command = config.command; // e.g. 'npx', 'python', 'node'
    this.args = config.args || []; // e.g. ['-y', '@modelcontextprotocol/server-filesystem', '/path']
    this.env = config.env || {};
    this.url = config.url; // for SSE transport
    this.cwd = config.cwd || process.cwd();
    this._process = null;
    this._buffer = '';
    this._requestId = 1;
    this._pending = new Map();
    this._tools = [];
    this._resources = [];
    this._connected = false;
    this._log = config.log || console.log;
  }

  async connect() {
    if (this.transport === 'stdio') {
      return this._connectStdio();
    } else if (this.transport === 'sse') {
      return this._connectSse();
    }
    throw new Error(`Unsupported transport: ${this.transport}`);
  }

  async _connectStdio() {
    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...this.env };

      this._log(`[MCP] Spawning: ${this.command} ${this.args.join(' ')}`);
      this._process = spawn(this.command, this.args, {
        cwd: this.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this._process.stdout.on('data', (chunk) => {
        this._buffer += chunk.toString();
        this._processBuffer();
      });

      this._process.stderr.on('data', (chunk) => {
        this._log(`[MCP] ${this.name} stderr: ${chunk.toString().trim()}`);
      });

      this._process.on('error', (err) => {
        this._log(`[MCP] ${this.name} process error: ${err.message}`);
        this._connected = false;
        this.emit('error', err);
        reject(err);
      });

      this._process.on('close', (code) => {
        this._log(`[MCP] ${this.name} exited with code ${code}`);
        this._connected = false;
        this.emit('close', code);
      });

      // Initialize MCP handshake
      setTimeout(async () => {
        try {
          const initResult = await this._sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'Dax', version: '1.0.0' },
          });

          this._log(`[MCP] ${this.name} initialized: ${JSON.stringify(initResult?.serverInfo || {})}`);

          // Send initialized notification
          this._sendNotification('notifications/initialized');

          // Fetch available tools
          const toolsResult = await this._sendRequest('tools/list', {});
          this._tools = toolsResult?.tools || [];
          this._log(`[MCP] ${this.name}: ${this._tools.length} tools available`);

          this._connected = true;
          this.emit('connected', { tools: this._tools });
          resolve({ tools: this._tools });
        } catch (err) {
          reject(err);
        }
      }, 500); // Small delay for process to start
    });
  }

  async _connectSse() {
    // SSE transport (HTTP-based MCP servers)
    if (!this.url) throw new Error('URL required for SSE transport');

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this._requestId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'Dax', version: '1.0.0' },
          },
        }),
      });

      const initResult = await response.json();
      this._log(`[MCP] ${this.name} SSE initialized`);

      // Fetch tools
      const toolsResponse = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this._requestId++,
          method: 'tools/list',
          params: {},
        }),
      });

      const toolsResult = await toolsResponse.json();
      this._tools = toolsResult?.result?.tools || [];
      this._connected = true;
      this.emit('connected', { tools: this._tools });
      return { tools: this._tools };
    } catch (err) {
      this._log(`[MCP] ${this.name} SSE error: ${err.message}`);
      throw err;
    }
  }

  _processBuffer() {
    // MCP uses JSON-RPC over newline-delimited JSON
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop() || ''; // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const msg = JSON.parse(trimmed);
        this._handleMessage(msg);
      } catch {
        // Not JSON, might be log output
      }
    }
  }

  _handleMessage(msg) {
    if (msg.id && this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
    } else if (msg.method) {
      // Server-initiated notification or request
      this.emit('notification', msg);
    }
  }

  _sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = this._requestId++;
      const msg = { jsonrpc: '2.0', id, method, params };

      this._pending.set(id, { resolve, reject });

      if (this.transport === 'stdio' && this._process?.stdin?.writable) {
        this._process.stdin.write(JSON.stringify(msg) + '\n');
      }

      // Timeout after 30s
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          reject(new Error(`MCP request timed out: ${method}`));
        }
      }, 30000);
    });
  }

  _sendNotification(method, params = {}) {
    const msg = { jsonrpc: '2.0', method, params };
    if (this.transport === 'stdio' && this._process?.stdin?.writable) {
      this._process.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  async callTool(toolName, args = {}) {
    if (!this._connected) throw new Error(`MCP server "${this.name}" not connected`);

    if (this.transport === 'sse') {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this._requestId++,
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
      return result.result;
    }

    return this._sendRequest('tools/call', { name: toolName, arguments: args });
  }

  getTools() {
    return this._tools;
  }

  isConnected() {
    return this._connected;
  }

  disconnect() {
    this._connected = false;
    if (this._process) {
      this._process.kill();
      this._process = null;
    }
    this._pending.forEach(({ reject }) => reject(new Error('Disconnected')));
    this._pending.clear();
    this.emit('disconnected');
  }
}

// ─── MCP Manager ────────────────────────────────────────────
// Manages multiple MCP server connections and registers their tools

const _clients = new Map();
let _log = console.log;

function setLogger(logFn) {
  _log = logFn;
}

async function addServer(config) {
  const client = new McpClient({ ...config, log: _log });

  try {
    await client.connect();
    _clients.set(client.id, client);
    _log(`[MCP] Server "${client.name}" connected with ${client.getTools().length} tools`);
    return {
      id: client.id,
      name: client.name,
      tools: client.getTools(),
    };
  } catch (err) {
    _log(`[MCP] Failed to connect "${config.name}": ${err.message}`);
    throw err;
  }
}

function removeServer(id) {
  const client = _clients.get(id);
  if (client) {
    client.disconnect();
    _clients.delete(id);
  }
}

function getServers() {
  return Array.from(_clients.values()).map((c) => ({
    id: c.id,
    name: c.name,
    connected: c.isConnected(),
    tools: c.getTools().map((t) => t.name),
  }));
}

function getAllTools() {
  const tools = [];
  for (const client of _clients.values()) {
    for (const tool of client.getTools()) {
      tools.push({
        ...tool,
        _mcpServer: client.id,
        _mcpServerName: client.name,
      });
    }
  }
  return tools;
}

async function callTool(serverIdOrToolName, toolName, args) {
  // Try direct server ID + tool name
  if (toolName && _clients.has(serverIdOrToolName)) {
    return _clients.get(serverIdOrToolName).callTool(toolName, args);
  }

  // Search all servers for the tool
  const searchName = toolName || serverIdOrToolName;
  for (const client of _clients.values()) {
    const hasTool = client.getTools().some((t) => t.name === searchName);
    if (hasTool) {
      return client.callTool(searchName, args || toolName);
    }
  }

  throw new Error(`MCP tool not found: ${searchName}`);
}

// Register all MCP tools into the main tool registry
function registerWithToolRegistry(toolRegistry) {
  for (const client of _clients.values()) {
    for (const tool of client.getTools()) {
      const mcpServerId = client.id;
      const mcpToolName = tool.name;

      toolRegistry.register({
        name: `mcp_${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_${mcpToolName}`,
        description: `[MCP: ${client.name}] ${tool.description || mcpToolName}`,
        parameters: tool.inputSchema || { type: 'object', properties: {} },
        execute: async (args) => {
          const result = await client.callTool(mcpToolName, args);
          return result;
        },
      });
    }
  }
}

function disconnectAll() {
  for (const client of _clients.values()) {
    client.disconnect();
  }
  _clients.clear();
}

module.exports = {
  McpClient,
  setLogger,
  addServer,
  removeServer,
  getServers,
  getAllTools,
  callTool,
  registerWithToolRegistry,
  disconnectAll,
};
