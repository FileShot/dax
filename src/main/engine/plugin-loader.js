// ─── Plugin SDK & Loader ────────────────────────────────────
// Discovers, loads, and manages Dax plugins from a plugins directory
// Each plugin: plugin.json manifest + entry script
// Plugins can register tools, integrations, hooks, and UI components

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const vm = require('vm');

let _log = (...args) => console.log('[Plugins]', ...args);

function setLogger(fn) { _log = fn; }

// ─── Plugin Hooks ───────────────────────────────────────────
const VALID_HOOKS = [
  'onAgentRunStart',
  'onAgentRunComplete',
  'onAgentRunError',
  'beforeToolExecute',
  'afterToolExecute',
  'onMessage',
  'onStartup',
  'onShutdown',
];

// ─── Plugin Sandbox API ─────────────────────────────────────
// API surface exposed to plugins — limited for security

function createPluginAPI(pluginId, pluginManager) {
  return {
    log: {
      info: (msg, data) => _log('info', `PLUGIN:${pluginId}`, msg, data),
      warn: (msg, data) => _log('warn', `PLUGIN:${pluginId}`, msg, data),
      error: (msg, data) => _log('error', `PLUGIN:${pluginId}`, msg, data),
    },

    registerTool: (toolDef) => {
      if (!toolDef.name || !toolDef.description || !toolDef.execute) {
        throw new Error('Tool requires: name, description, execute function');
      }
      pluginManager.registerPluginTool(pluginId, toolDef);
    },

    registerHook: (hookName, handler) => {
      if (!VALID_HOOKS.includes(hookName)) {
        throw new Error(`Invalid hook: ${hookName}. Valid: ${VALID_HOOKS.join(', ')}`);
      }
      pluginManager.registerPluginHook(pluginId, hookName, handler);
    },

    settings: {
      get: (key) => pluginManager.getPluginSetting(pluginId, key),
      set: (key, value) => pluginManager.setPluginSetting(pluginId, key, value),
    },

    // HTTP helper (limited to prevent abuse)
    fetch: async (url, options = {}) => {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP/HTTPS URLs allowed');
      }
      const mod = parsed.protocol === 'https:' ? require('https') : require('http');
      return new Promise((resolve, reject) => {
        const req = mod.request(url, {
          method: options.method || 'GET',
          headers: options.headers || {},
          timeout: 10000,
        }, (res) => {
          let data = '';
          res.on('data', (c) => data += c);
          res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        req.end();
      });
    },
  };
}

// ─── Plugin Manager ─────────────────────────────────────────

class PluginManager extends EventEmitter {
  constructor(pluginsDir) {
    super();
    this._pluginsDir = pluginsDir;
    this._plugins = new Map();     // id -> { manifest, loaded, enabled, instance }
    this._tools = new Map();       // pluginId:toolName -> toolDef
    this._hooks = new Map();       // hookName -> [{ pluginId, handler }]
    this._settings = new Map();    // pluginId -> { key: value }

    // Initialize hook arrays
    for (const hook of VALID_HOOKS) {
      this._hooks.set(hook, []);
    }
  }

  /**
   * Discover plugins in the plugins directory
   */
  async discover() {
    if (!fs.existsSync(this._pluginsDir)) {
      fs.mkdirSync(this._pluginsDir, { recursive: true });
      _log('info', 'PLUGINS', 'Created plugins directory', { path: this._pluginsDir });
      return [];
    }

    const entries = fs.readdirSync(this._pluginsDir, { withFileTypes: true });
    const discovered = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(this._pluginsDir, entry.name);
      const manifestPath = path.join(pluginDir, 'plugin.json');

      if (!fs.existsSync(manifestPath)) {
        _log('warn', 'PLUGINS', `Skipping ${entry.name}: no plugin.json`);
        continue;
      }

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

        // Validate manifest
        if (!manifest.id || !manifest.name || !manifest.main) {
          _log('warn', 'PLUGINS', `Invalid manifest in ${entry.name}`, manifest);
          continue;
        }

        const entryPath = path.join(pluginDir, manifest.main);
        if (!fs.existsSync(entryPath)) {
          _log('warn', 'PLUGINS', `Entry file missing: ${manifest.main} in ${entry.name}`);
          continue;
        }

        discovered.push({
          ...manifest,
          _dir: pluginDir,
          _entryPath: entryPath,
        });

        _log('info', 'PLUGINS', `Discovered plugin: ${manifest.name} v${manifest.version || '0.0.0'}`);
      } catch (err) {
        _log('error', 'PLUGINS', `Error reading plugin ${entry.name}`, { error: err.message });
      }
    }

    return discovered;
  }

  /**
   * Load and activate a plugin
   */
  async loadPlugin(manifest) {
    const pluginId = manifest.id;

    if (this._plugins.has(pluginId)) {
      _log('warn', 'PLUGINS', `Plugin already loaded: ${pluginId}`);
      return;
    }

    try {
      const code = fs.readFileSync(manifest._entryPath, 'utf-8');
      const api = createPluginAPI(pluginId, this);

      // Run plugin in a limited context
      const sandbox = {
        module: { exports: {} },
        exports: {},
        require: (mod) => {
          // Only allow safe modules
          const allowed = ['path', 'url', 'querystring', 'crypto', 'buffer'];
          if (allowed.includes(mod)) return require(mod);
          throw new Error(`Plugin cannot require '${mod}'. Allowed: ${allowed.join(', ')}`);
        },
        console: api.log,
        dax: api,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Buffer,
        JSON,
        Date,
        Math,
        RegExp,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Map,
        Set,
        Promise,
        Error,
      };

      const script = new vm.Script(code, {
        filename: manifest._entryPath,
        timeout: 5000,
      });

      const context = vm.createContext(sandbox);
      script.runInContext(context);

      const pluginExports = sandbox.module.exports || sandbox.exports;

      // Call activate if defined
      if (typeof pluginExports.activate === 'function') {
        await pluginExports.activate(api);
      }

      this._plugins.set(pluginId, {
        manifest,
        loaded: true,
        enabled: true,
        instance: pluginExports,
      });

      _log('info', 'PLUGINS', `Loaded plugin: ${manifest.name}`);
      this.emit('plugin-loaded', pluginId);

      // Fire onStartup hook for this plugin
      await this.fireHook('onStartup', { pluginId });

    } catch (err) {
      _log('error', 'PLUGINS', `Failed to load plugin ${pluginId}`, { error: err.message });
      this._plugins.set(pluginId, {
        manifest,
        loaded: false,
        enabled: false,
        error: err.message,
      });
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId) {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) return;

    try {
      // Call deactivate if defined
      if (plugin.instance && typeof plugin.instance.deactivate === 'function') {
        await plugin.instance.deactivate();
      }

      // Fire onShutdown hook
      await this.fireHook('onShutdown', { pluginId });
    } catch (err) {
      _log('error', 'PLUGINS', `Error deactivating ${pluginId}`, { error: err.message });
    }

    // Remove tools
    for (const [key] of this._tools) {
      if (key.startsWith(`${pluginId}:`)) {
        this._tools.delete(key);
      }
    }

    // Remove hooks
    for (const [hookName, handlers] of this._hooks) {
      this._hooks.set(hookName, handlers.filter((h) => h.pluginId !== pluginId));
    }

    this._plugins.delete(pluginId);
    _log('info', 'PLUGINS', `Unloaded plugin: ${pluginId}`);
    this.emit('plugin-unloaded', pluginId);
  }

  /**
   * Load all discovered plugins
   */
  async loadAll() {
    const discovered = await this.discover();
    for (const manifest of discovered) {
      await this.loadPlugin(manifest);
    }
    _log('info', 'PLUGINS', `Loaded ${this._plugins.size} plugins`);
  }

  /**
   * Unload all plugins
   */
  async unloadAll() {
    for (const pluginId of [...this._plugins.keys()]) {
      await this.unloadPlugin(pluginId);
    }
  }

  // ─── Plugin Tools ─────────────────────────────────────

  registerPluginTool(pluginId, toolDef) {
    const key = `${pluginId}:${toolDef.name}`;
    this._tools.set(key, {
      ...toolDef,
      pluginId,
      name: `plugin_${pluginId}_${toolDef.name}`,
    });
    _log('info', 'PLUGINS', `Registered tool: ${toolDef.name} from ${pluginId}`);
  }

  getPluginTools() {
    return [...this._tools.values()];
  }

  /**
   * Register all plugin tools with the main tool registry
   */
  registerWithToolRegistry(toolRegistry) {
    for (const tool of this._tools.values()) {
      toolRegistry.register({
        name: tool.name,
        description: `[Plugin: ${tool.pluginId}] ${tool.description}`,
        parameters: tool.parameters || {},
        execute: tool.execute,
      });
    }
  }

  // ─── Plugin Hooks ─────────────────────────────────────

  registerPluginHook(pluginId, hookName, handler) {
    const hooks = this._hooks.get(hookName);
    if (hooks) {
      hooks.push({ pluginId, handler });
      _log('info', 'PLUGINS', `Registered hook: ${hookName} from ${pluginId}`);
    }
  }

  async fireHook(hookName, data) {
    const hooks = this._hooks.get(hookName) || [];
    for (const { pluginId, handler } of hooks) {
      try {
        await handler(data);
      } catch (err) {
        _log('error', 'PLUGINS', `Hook ${hookName} error in ${pluginId}`, { error: err.message });
      }
    }
  }

  // ─── Plugin Settings ──────────────────────────────────

  getPluginSetting(pluginId, key) {
    const settings = this._settings.get(pluginId) || {};
    return settings[key];
  }

  setPluginSetting(pluginId, key, value) {
    const settings = this._settings.get(pluginId) || {};
    settings[key] = value;
    this._settings.set(pluginId, settings);
  }

  // ─── Plugin Info ──────────────────────────────────────

  list() {
    return [...this._plugins.entries()].map(([id, p]) => ({
      id,
      name: p.manifest.name,
      version: p.manifest.version || '0.0.0',
      description: p.manifest.description || '',
      author: p.manifest.author || '',
      loaded: p.loaded,
      enabled: p.enabled,
      error: p.error || null,
      tools: [...this._tools.entries()]
        .filter(([k]) => k.startsWith(`${id}:`))
        .map(([, t]) => t.name),
      hooks: [...this._hooks.entries()]
        .filter(([, handlers]) => handlers.some((h) => h.pluginId === id))
        .map(([hookName]) => hookName),
    }));
  }

  get(pluginId) {
    return this._plugins.get(pluginId);
  }

  getPluginsDir() {
    return this._pluginsDir;
  }
}

module.exports = { PluginManager, setLogger, VALID_HOOKS };
