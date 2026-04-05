// ─── Tool Registry ──────────────────────────────────────────
// Central registry for all built-in and plugin tools.
// Each tool has: name, description, parameters (JSON schema), execute function.

const _tools = new Map();

function register(tool) {
  if (!tool.name || !tool.execute) {
    throw new Error(`Tool must have name and execute: ${JSON.stringify(tool)}`);
  }
  _tools.set(tool.name, {
    name: tool.name,
    description: tool.description || '',
    parameters: tool.parameters || { type: 'object', properties: {} },
    execute: tool.execute,
  });
}

function get(name) {
  return _tools.get(name) || null;
}

function list() {
  return Array.from(_tools.values()).map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

function toOpenAITools() {
  return Array.from(_tools.values()).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

async function execute(name, args, context = {}) {
  const tool = _tools.get(name);
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    const result = await tool.execute(args, context);
    return { result };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { register, get, list, toOpenAITools, execute };
