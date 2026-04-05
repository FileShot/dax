// ─── File System Integration ────────────────────────────────
// Sandboxed file operations for agents
// Restricted to configured directories only

const fs = require('fs');
const path = require('path');

function validatePath(requestedPath, allowedDirs) {
  const resolved = path.resolve(requestedPath);
  const allowed = allowedDirs.map((d) => path.resolve(d));

  if (!allowed.some((dir) => resolved.startsWith(dir + path.sep) || resolved === dir)) {
    throw new Error(`Access denied: path "${requestedPath}" is outside allowed directories`);
  }

  return resolved;
}

module.exports = {
  id: 'filesystem',
  name: 'File System',
  category: 'utility',
  icon: 'FolderOpen',
  description: 'Read, write, and list files in sandboxed directories',
  configFields: [
    { key: 'allowed_dirs', label: 'Allowed Directories (comma-separated)', type: 'text', required: true, placeholder: 'C:\\data,C:\\reports' },
    { key: 'max_file_size_mb', label: 'Max File Size (MB)', type: 'text', placeholder: '10' },
  ],

  credentials: null,
  connected: false,

  _getAllowedDirs() {
    if (!this.credentials?.allowed_dirs) return [];
    return this.credentials.allowed_dirs.split(',').map((d) => d.trim()).filter(Boolean);
  },

  async connect(creds) {
    const dirs = creds.allowed_dirs?.split(',').map(d => d.trim()).filter(Boolean) || [];
    if (dirs.length === 0) throw new Error('At least one allowed directory required');
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) throw new Error(`Directory not found: ${dir}`);
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
      const dirs = creds.allowed_dirs?.split(',').map(d => d.trim()).filter(Boolean) || [];
      const results = [];
      for (const dir of dirs) {
        const exists = fs.existsSync(dir);
        results.push(`${dir}: ${exists ? 'OK' : 'NOT FOUND'}`);
      }
      const allOk = dirs.every((d) => fs.existsSync(d));
      return { success: allOk, message: results.join(', ') };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    read_file: async (params, creds) => {
      const dirs = creds.allowed_dirs.split(',').map(d => d.trim());
      const filePath = validatePath(params.path, dirs);
      const maxSize = (parseInt(creds.max_file_size_mb) || 10) * 1024 * 1024;
      const stats = fs.statSync(filePath);
      if (stats.size > maxSize) throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB exceeds limit`);
      const content = fs.readFileSync(filePath, params.encoding || 'utf-8');
      return { path: filePath, size: stats.size, content };
    },

    write_file: async (params, creds) => {
      const dirs = creds.allowed_dirs.split(',').map(d => d.trim());
      const filePath = validatePath(params.path, dirs);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, params.content, params.encoding || 'utf-8');
      return { path: filePath, size: Buffer.byteLength(params.content), written: true };
    },

    append_file: async (params, creds) => {
      const dirs = creds.allowed_dirs.split(',').map(d => d.trim());
      const filePath = validatePath(params.path, dirs);
      fs.appendFileSync(filePath, params.content, params.encoding || 'utf-8');
      return { path: filePath, appended: true };
    },

    list_dir: async (params, creds) => {
      const dirs = creds.allowed_dirs.split(',').map(d => d.trim());
      const dirPath = validatePath(params.path, dirs);
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, e.name),
      }));
    },

    file_info: async (params, creds) => {
      const dirs = creds.allowed_dirs.split(',').map(d => d.trim());
      const filePath = validatePath(params.path, dirs);
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        size: stats.size,
        isDirectory: stats.isDirectory(),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
      };
    },

    delete_file: async (params, creds) => {
      const dirs = creds.allowed_dirs.split(',').map(d => d.trim());
      const filePath = validatePath(params.path, dirs);
      if (fs.statSync(filePath).isDirectory()) throw new Error('Cannot delete directories — use delete with care');
      fs.unlinkSync(filePath);
      return { path: filePath, deleted: true };
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
