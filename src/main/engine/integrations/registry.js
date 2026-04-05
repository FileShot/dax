// ─── Integration Registry ───────────────────────────────────
// Central hub for all external integrations (Slack, Discord, Google, DB, etc.)
// Each integration: id, name, category, icon, configFields, connect/disconnect/test

const EventEmitter = require('events');

class Integration extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.category = config.category; // 'communication', 'productivity', 'database', 'cloud'
    this.icon = config.icon;
    this.description = config.description || '';
    this.configFields = config.configFields || [];
    this.credentials = {};
    this.connected = false;
    this._connect = config.connect;
    this._disconnect = config.disconnect;
    this._test = config.test;
    this._actions = config.actions || {};
  }

  async connect(creds) {
    this.credentials = creds;
    if (this._connect) {
      await this._connect(creds);
    }
    this.connected = true;
    this.emit('connected');
  }

  async disconnect() {
    if (this._disconnect) {
      await this._disconnect();
    }
    this.connected = false;
    this.credentials = {};
    this.emit('disconnected');
  }

  async test(creds) {
    if (this._test) {
      return this._test(creds || this.credentials);
    }
    return { success: true, message: 'No test available' };
  }

  async executeAction(actionName, params) {
    const action = this._actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  }

  getActions() {
    return Object.keys(this._actions);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      icon: this.icon,
      description: this.description,
      configFields: this.configFields,
      connected: this.connected,
      actions: Object.keys(this._actions),
    };
  }
}

// ─── Registry ───────────────────────────────────────────────
const _integrations = new Map();

function register(config) {
  const integration = new Integration(config);
  _integrations.set(integration.id, integration);
  return integration;
}

function get(id) {
  return _integrations.get(id);
}

function list() {
  return Array.from(_integrations.values()).map((i) => i.toJSON());
}

function listByCategory(category) {
  return Array.from(_integrations.values())
    .filter((i) => i.category === category)
    .map((i) => i.toJSON());
}

// Register tools from connected integrations into the tool registry
function registerWithToolRegistry(toolRegistry) {
  for (const integration of _integrations.values()) {
    if (!integration.connected) continue;

    for (const [actionName, actionFn] of Object.entries(integration._actions)) {
      toolRegistry.register({
        name: `integration_${integration.id}_${actionName}`,
        description: `[${integration.name}] ${actionName.replace(/_/g, ' ')}`,
        parameters: { type: 'object', properties: {} },
        execute: async (args) => {
          return actionFn(args, integration.credentials);
        },
      });
    }
  }
}

module.exports = { Integration, register, get, list, listByCategory, registerWithToolRegistry };
