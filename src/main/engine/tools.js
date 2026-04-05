// ─── Built-in Tools ─────────────────────────────────────────
// All tools follow the pattern: { name, description, parameters, execute(args, ctx) }

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ─── HTTP Request ───────────────────────────────────────────
const httpRequest = {
  name: 'http_request',
  description: 'Make an HTTP/HTTPS request to a URL. Supports GET, POST, PUT, PATCH, DELETE.',
  parameters: {
    type: 'object',
    properties: {
      url:     { type: 'string', description: 'The URL to request' },
      method:  { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], description: 'HTTP method' },
      headers: { type: 'object', description: 'Request headers as key-value pairs' },
      body:    { type: 'string', description: 'Request body (for POST/PUT/PATCH)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const { url: rawUrl, method = 'GET', headers = {}, body, timeout = 30000 } = args;

    // Validate URL
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (_) {
      throw new Error(`Invalid URL: ${rawUrl}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Only http/https URLs are supported: ${parsed.protocol}`);
    }

    const client = parsed.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Request timed out')), timeout);

      const req = client.request(parsed, {
        method: method.toUpperCase(),
        headers: { ...headers },
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timer);
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseBody.length > 50000 ? responseBody.slice(0, 50000) + '\n[truncated]' : responseBody,
          });
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        req.write(body);
      }
      req.end();
    });
  },
};

// ─── Read File ──────────────────────────────────────────────
const readFile = {
  name: 'read_file',
  description: 'Read the contents of a file. Returns the text content.',
  parameters: {
    type: 'object',
    properties: {
      path:     { type: 'string', description: 'Absolute path to the file' },
      encoding: { type: 'string', description: 'File encoding (default: utf-8)' },
      max_size: { type: 'number', description: 'Maximum bytes to read (default: 100000)' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const filePath = path.resolve(args.path);
    const encoding = args.encoding || 'utf-8';
    const maxSize = args.max_size || 100000;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size > maxSize) {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(maxSize);
      fs.readSync(fd, buffer, 0, maxSize, 0);
      fs.closeSync(fd);
      return { content: buffer.toString(encoding) + '\n[truncated]', size: stats.size, truncated: true };
    }

    const content = fs.readFileSync(filePath, encoding);
    return { content, size: stats.size, truncated: false };
  },
};

// ─── Write File ─────────────────────────────────────────────
const writeFile = {
  name: 'write_file',
  description: 'Write content to a file. Creates the file and parent directories if they do not exist.',
  parameters: {
    type: 'object',
    properties: {
      path:    { type: 'string', description: 'Absolute path to the file' },
      content: { type: 'string', description: 'Content to write' },
      append:  { type: 'boolean', description: 'Append instead of overwrite (default: false)' },
    },
    required: ['path', 'content'],
  },
  execute: async (args) => {
    const filePath = path.resolve(args.path);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (args.append) {
      fs.appendFileSync(filePath, args.content, 'utf-8');
    } else {
      fs.writeFileSync(filePath, args.content, 'utf-8');
    }

    return { path: filePath, bytes: Buffer.byteLength(args.content, 'utf-8'), appended: !!args.append };
  },
};

// ─── List Directory ─────────────────────────────────────────
const listDirectory = {
  name: 'list_directory',
  description: 'List the contents of a directory with file sizes and types.',
  parameters: {
    type: 'object',
    properties: {
      path:      { type: 'string', description: 'Absolute path to the directory' },
      recursive: { type: 'boolean', description: 'List recursively (default: false)' },
      max_depth: { type: 'number', description: 'Max recursion depth (default: 3)' },
    },
    required: ['path'],
  },
  execute: async (args) => {
    const dirPath = path.resolve(args.path);

    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    function scan(dir, depth = 0) {
      const entries = [];
      const maxDepth = args.max_depth || 3;
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const entry = {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
        };

        if (item.isFile()) {
          try {
            entry.size = fs.statSync(fullPath).size;
          } catch (_) {
            entry.size = 0;
          }
        }

        entries.push(entry);

        if (args.recursive && item.isDirectory() && depth < maxDepth) {
          try {
            entry.children = scan(fullPath, depth + 1);
          } catch (_) {
            entry.children = [];
          }
        }
      }
      return entries;
    }

    return { path: dirPath, entries: scan(dirPath) };
  },
};

// ─── Execute Command ────────────────────────────────────────
const executeCommand = {
  name: 'execute_command',
  description: 'Execute a shell command and return the output. Use with caution.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute' },
      cwd:     { type: 'string', description: 'Working directory (optional)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
    },
    required: ['command'],
  },
  execute: async (args) => {
    const { command, cwd, timeout = 30000 } = args;

    // Block dangerous commands
    const blocked = ['rm -rf /', 'format ', 'del /s /q', 'rmdir /s /q'];
    const lowerCmd = command.toLowerCase();
    for (const b of blocked) {
      if (lowerCmd.includes(b)) {
        throw new Error(`Blocked dangerous command pattern: ${b}`);
      }
    }

    try {
      const output = execSync(command, {
        cwd: cwd || os.homedir(),
        timeout,
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      return { stdout: output.slice(0, 50000), exitCode: 0 };
    } catch (err) {
      return {
        stdout: (err.stdout || '').slice(0, 50000),
        stderr: (err.stderr || '').slice(0, 50000),
        exitCode: err.status || 1,
      };
    }
  },
};

// ─── JSON Parse ─────────────────────────────────────────────
const jsonParse = {
  name: 'json_parse',
  description: 'Parse a JSON string and optionally extract a value using a dot-notation path.',
  parameters: {
    type: 'object',
    properties: {
      json: { type: 'string', description: 'The JSON string to parse' },
      path: { type: 'string', description: 'Dot-notation path to extract (e.g. "data.items[0].name")' },
    },
    required: ['json'],
  },
  execute: async (args) => {
    const parsed = JSON.parse(args.json);

    if (!args.path) return { value: parsed };

    const parts = args.path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = parsed;
    for (const part of parts) {
      if (current == null) return { value: null, path: args.path };
      current = current[part];
    }
    return { value: current, path: args.path };
  },
};

// ─── System Info ────────────────────────────────────────────
const systemInfo = {
  name: 'system_info',
  description: 'Get system information: platform, CPU, memory, uptime.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
    };
  },
};

// ─── Send Notification ──────────────────────────────────────
const sendNotification = {
  name: 'send_notification',
  description: 'Show a desktop notification to the user.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Notification title' },
      body:  { type: 'string', description: 'Notification body text' },
    },
    required: ['title'],
  },
  execute: async (args, context) => {
    const { Notification } = require('electron');
    const notif = new Notification({
      title: args.title,
      body: args.body || '',
    });
    notif.show();
    return { sent: true };
  },
};

// ─── Web Scraper ────────────────────────────────────────────
const webScraper = {
  name: 'web_scraper',
  description: 'Fetch a web page and extract its text content (strips HTML tags).',
  parameters: {
    type: 'object',
    properties: {
      url:     { type: 'string', description: 'The URL to scrape' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 15000)' },
    },
    required: ['url'],
  },
  execute: async (args) => {
    const result = await httpRequest.execute({
      url: args.url,
      method: 'GET',
      timeout: args.timeout || 15000,
      headers: { 'User-Agent': 'Dax/0.1.0' },
    });

    // Strip HTML tags to extract text
    const text = result.body
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      url: args.url,
      status: result.status,
      text: text.length > 50000 ? text.slice(0, 50000) + '\n[truncated]' : text,
      length: text.length,
    };
  },
};

// ─── Registration ───────────────────────────────────────────
function registerAll(registry) {
  const tools = [
    httpRequest,
    readFile,
    writeFile,
    listDirectory,
    executeCommand,
    jsonParse,
    systemInfo,
    sendNotification,
    webScraper,
  ];

  for (const tool of tools) {
    registry.register(tool);
  }
}

module.exports = { registerAll };
