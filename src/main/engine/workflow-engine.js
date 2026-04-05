// ─── Workflow Engine ────────────────────────────────────────
// Executes a workflow graph: topological traversal of nodes,
// data flow via edges, branching, looping, and per-node logging.
// Called by agent-runner when an agent has a non-empty nodes array.

const vm = require('vm');

// ─── Main Entry ─────────────────────────────────────────────
async function executeWorkflow(agent, triggerData, context) {
  const { runId, db, dbRun, log, llmClient, toolRegistry, cancelCheck } = context;
  const nodes = JSON.parse(agent.nodes || '[]');
  const edges = JSON.parse(agent.edges || '[]');

  if (nodes.length === 0) {
    throw new Error('Workflow has no nodes');
  }

  const nodeOutputs = new Map();  // nodeId → output data
  const nodeErrors = [];          // track failed nodes
  let totalTokens = 0;

  // ─── Build Graph ──────────────────────────────────────
  const adjacency = new Map();    // nodeId → [{ targetId, sourceHandle, targetHandle }]
  const inDegree = new Map();     // nodeId → count of incoming edges
  const incomingEdges = new Map();// nodeId → [{ sourceId, sourceHandle, targetHandle }]
  const nodeMap = new Map();      // nodeId → node data

  for (const node of nodes) {
    const id = node.id;
    nodeMap.set(id, node);
    adjacency.set(id, []);
    inDegree.set(id, 0);
    incomingEdges.set(id, []);
  }

  for (const edge of edges) {
    const src = edge.source;
    const tgt = edge.target;
    if (!nodeMap.has(src) || !nodeMap.has(tgt)) continue;

    adjacency.get(src).push({
      targetId: tgt,
      sourceHandle: edge.sourceHandle || 'out',
      targetHandle: edge.targetHandle || 'in',
    });

    incomingEdges.get(tgt).push({
      sourceId: src,
      sourceHandle: edge.sourceHandle || 'out',
      targetHandle: edge.targetHandle || 'in',
    });

    inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
  }

  // ─── Topological Sort (Kahn's Algorithm) ──────────────
  const sorted = [];
  const queue = [];

  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const tempInDegree = new Map(inDegree);
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);
    for (const edge of (adjacency.get(id) || [])) {
      const newDeg = tempInDegree.get(edge.targetId) - 1;
      tempInDegree.set(edge.targetId, newDeg);
      if (newDeg === 0) queue.push(edge.targetId);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Workflow contains a cycle — cannot execute');
  }

  // ─── Execute Nodes in Order ───────────────────────────
  for (const nodeId of sorted) {
    if (cancelCheck()) {
      logNode(dbRun, db, runId, nodeId, 'warn', 'Workflow cancelled');
      break;
    }

    const node = nodeMap.get(nodeId);
    const nodeType = node.data?.nodeType || node.type || 'unknown';
    const config = node.data?.config || {};

    // Gather input from incoming edges
    const input = gatherInput(nodeId, incomingEdges, nodeOutputs);

    // Skip nodes whose branch wasn't taken (received null from a branching parent)
    const incoming = incomingEdges.get(nodeId) || [];
    if (incoming.length > 0 && input === null) {
      nodeOutputs.set(nodeId, null);
      logNode(dbRun, db, runId, nodeId, 'info', `Skipped node: ${nodeType} (branch not taken)`);
      continue;
    }

    // Interpolate config values
    const resolvedConfig = interpolateConfig(config, nodeOutputs);

    logNode(dbRun, db, runId, nodeId, 'info', `Executing node: ${nodeType}`, { config: resolvedConfig });

    try {
      const result = await executeNode(nodeType, resolvedConfig, input, {
        runId, nodeId, db, dbRun, log, llmClient, toolRegistry,
        triggerData, agent, cancelCheck, nodeOutputs, adjacency, incomingEdges, nodeMap,
      });

      // Track tokens from AI nodes
      if (result && result._tokens) {
        totalTokens += result._tokens;
        delete result._tokens;
      }

      // Handle branching nodes (if_else, filter)
      if (result && result._branch) {
        // Store branch info so edge routing works
        nodeOutputs.set(nodeId, { ...result, _branchKey: result._branch });
      } else {
        nodeOutputs.set(nodeId, result);
      }

      logNode(dbRun, db, runId, nodeId, 'info', `Node completed: ${nodeType}`, {
        outputPreview: JSON.stringify(result).slice(0, 300),
      });

    } catch (err) {
      // Skip-and-continue: log error, pass error downstream
      nodeErrors.push({ nodeId, nodeType, error: err.message });
      nodeOutputs.set(nodeId, { _error: true, error: err.message });
      logNode(dbRun, db, runId, nodeId, 'error', `Node failed: ${nodeType} — ${err.message}`);
    }
  }

  // ─── Determine final output ───────────────────────────
  // Terminal nodes = nodes with no outgoing edges
  const terminalNodes = sorted.filter(id => {
    const outEdges = adjacency.get(id) || [];
    return outEdges.length === 0;
  });

  let finalOutput = null;
  // Filter out skipped terminal nodes (null from branches not taken)
  const activeTerminals = terminalNodes.filter(id => nodeOutputs.get(id) !== null);

  if (activeTerminals.length === 1) {
    finalOutput = cleanOutput(nodeOutputs.get(activeTerminals[0]));
  } else if (activeTerminals.length > 1) {
    finalOutput = {};
    for (const id of activeTerminals) {
      finalOutput[id] = cleanOutput(nodeOutputs.get(id));
    }
  } else if (terminalNodes.length === 1) {
    finalOutput = cleanOutput(nodeOutputs.get(terminalNodes[0]));
  }

  return {
    output: finalOutput,
    tokens: totalTokens,
    nodeCount: sorted.length,
    errors: nodeErrors,
    status: nodeErrors.length > 0 ? 'completed_with_errors' : 'completed',
  };
}

// ─── Gather Input for a Node ────────────────────────────────
function gatherInput(nodeId, incomingEdges, nodeOutputs) {
  const incoming = incomingEdges.get(nodeId) || [];
  if (incoming.length === 0) return null;

  if (incoming.length === 1) {
    const edge = incoming[0];
    const srcOutput = nodeOutputs.get(edge.sourceId);
    // Handle branching: only pass data if the branch matches
    if (srcOutput && srcOutput._branchKey) {
      if (edge.sourceHandle === srcOutput._branchKey) {
        const { _branchKey, _branch, ...data } = srcOutput;
        return data.data !== undefined ? data.data : data;
      }
      return null; // This branch wasn't taken
    }
    // Handle multi-output nodes (filter, etc.) — route by sourceHandle key
    if (srcOutput && srcOutput._multiOutput && edge.sourceHandle && edge.sourceHandle !== 'out') {
      return srcOutput[edge.sourceHandle] !== undefined ? srcOutput[edge.sourceHandle] : srcOutput;
    }
    return srcOutput;
  }

  // Multiple inputs — merge by target handle
  const merged = {};
  for (const edge of incoming) {
    const srcOutput = nodeOutputs.get(edge.sourceId);
    if (srcOutput && srcOutput._branchKey && edge.sourceHandle !== srcOutput._branchKey) {
      continue; // Skip branches not taken
    }
    // Multi-output routing
    if (srcOutput && srcOutput._multiOutput && edge.sourceHandle && edge.sourceHandle !== 'out') {
      merged[edge.targetHandle] = srcOutput[edge.sourceHandle] !== undefined ? srcOutput[edge.sourceHandle] : srcOutput;
    } else {
      merged[edge.targetHandle] = srcOutput;
    }
  }
  return merged;
}

// ─── Interpolate Config ─────────────────────────────────────
// Replace {{nodeId.path}} with actual values from nodeOutputs
function interpolateConfig(config, nodeOutputs) {
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\{\{(\w+)\.?([\w.]*)\}\}/g, (_match, nodeId, path) => {
        const output = nodeOutputs.get(nodeId);
        if (output === undefined) return _match;
        if (!path) return typeof output === 'string' ? output : JSON.stringify(output);
        return resolvePath(output, path);
      });
    } else {
      result[key] = value;
    }
  }
  return result;
}

function resolvePath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return '';
    current = current[part];
  }
  return typeof current === 'string' ? current : JSON.stringify(current);
}

// ─── Node Executor ──────────────────────────────────────────
async function executeNode(nodeType, config, input, ctx) {
  switch (nodeType) {
    // ── Triggers ──────────────────────────
    case 'manual_trigger':
      return ctx.triggerData || { prompt: config.prompt || '' };

    case 'schedule_trigger':
      return ctx.triggerData || { cron: config.cron, triggered_at: new Date().toISOString() };

    case 'webhook_trigger':
      return ctx.triggerData || { method: config.method, path: config.path };

    case 'file_watch_trigger':
      return ctx.triggerData || { path: config.path };

    // ── AI Processors ─────────────────────
    case 'ai_analyze':
      return aiNode(config.prompt || 'Analyze the following:', input, config, ctx);

    case 'ai_extract':
      return aiNode(
        `Extract the following fields: ${config.fields || 'all relevant data'}. Output as ${config.format || 'json'}.`,
        input, config, ctx
      );

    case 'ai_summarize':
      return aiNode(
        `Summarize the following in ${config.style || 'concise'} style, max ${config.maxLength || 200} words:`,
        input, config, ctx
      );

    case 'ai_classify':
      return aiNode(
        `Classify the following into these categories: ${config.categories || 'unknown'}. ${config.multiLabel ? 'Multiple labels allowed.' : 'Choose one.'}`,
        input, config, ctx
      );

    case 'ai_generate':
      return aiNode(config.prompt || 'Generate a response based on:', input, config, ctx);

    // ── Transform ─────────────────────────
    case 'transform':
      return executeTransform(config.code || 'return input;', input);

    // ── Actions ───────────────────────────
    case 'http_request':
      return executeAction('http_request', {
        url: config.url,
        method: config.method || 'GET',
        headers: config.headers || '{}',
        body: config.body || '',
      }, input, ctx);

    case 'write_file':
      return executeAction('write_file', {
        path: config.path,
        content: typeof input === 'string' ? input : JSON.stringify(input, null, 2),
        append: config.append || false,
      }, input, ctx);

    case 'exec_command':
      return executeAction('execute_command', {
        command: config.command,
        cwd: config.cwd || undefined,
      }, input, ctx);

    case 'notification': {
      const title = config.title || 'Dax Agent';
      const body = config.body || (typeof input === 'string' ? input : JSON.stringify(input));
      // Use Electron notification if available
      try {
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          new Notification({ title, body: body.slice(0, 500) }).show();
        }
      } catch (_) { /* not in Electron context */ }
      return { notified: true, title, body };
    }

    case 'log_output':
      logNode(ctx.dbRun, ctx.db, ctx.runId, ctx.nodeId, config.level || 'info',
        config.label || 'Log output', { data: input });
      return input; // passthrough

    // ── Logic ─────────────────────────────
    case 'if_else':
      return executeIfElse(config, input);

    case 'loop':
      return executeLoop(config, input, ctx);

    case 'delay': {
      const seconds = Math.min(Math.max(config.seconds || 5, 0), 300); // cap at 5 min
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      return input; // passthrough
    }

    case 'filter':
      return executeFilter(config, input);

    case 'merge':
      return executeMerge(config, input);

    // ── Multi-Agent ───────────────────────
    case 'agent_call': {
      // Call another agent and return its result
      const targetAgentId = config.agent_id;
      if (!targetAgentId) throw new Error('agent_call: agent_id required');

      // Get the target agent from DB
      const targetAgent = ctx.dbGet(ctx.db, 'SELECT * FROM agents WHERE id = ?', [targetAgentId]);
      if (!targetAgent) throw new Error(`agent_call: agent "${targetAgentId}" not found`);

      // Build trigger data — pass current input as the message/payload
      const callTrigger = {
        trigger: 'agent_call',
        caller_agent_id: ctx.agent?.id,
        caller_run_id: ctx.runId,
        message: config.message || (typeof input === 'string' ? input : JSON.stringify(input)),
        payload: input,
      };

      // Execute the target agent (re-uses the same executeAgent from runner)
      const { executeAgent } = require('./agent-runner');
      const result = await executeAgent(targetAgent, callTrigger, {
        dbAll: ctx.dbAll, dbGet: ctx.dbGet, dbRun: ctx.dbRun, getDb: () => ctx.db, log: ctx.log || (() => {}),
      });

      return result;
    }

    // ── RAG Nodes ─────────────────────────
    case 'rag_ingest': {
      const kb = require('./rag/knowledge-base');
      const kbId = config.kb_id;
      if (!kbId) throw new Error('rag_ingest: kb_id required');

      if (config.file_path) {
        const result = await kb.ingestFile({ kbId, filePath: config.file_path, model: config.model, chunkSize: config.chunk_size, overlap: config.overlap });
        return { ingested: true, ...result };
      } else {
        const text = config.text || (typeof input === 'string' ? input : JSON.stringify(input));
        const result = await kb.ingestText({ kbId, text, metadata: config.metadata, model: config.model, chunkSize: config.chunk_size, overlap: config.overlap });
        return { ingested: true, ...result };
      }
    }

    case 'rag_query': {
      const kb = require('./rag/knowledge-base');
      const kbId = config.kb_id;
      if (!kbId) throw new Error('rag_query: kb_id required');
      const question = config.question || (typeof input === 'string' ? input : JSON.stringify(input));
      const result = await kb.query({ kbId, question, topK: config.top_k || 5, model: config.model });
      return result;
    }

    case 'rag_augmented_generate': {
      const kb = require('./rag/knowledge-base');
      const kbId = config.kb_id;
      if (!kbId) throw new Error('rag_augmented_generate: kb_id required');
      const question = config.question || (typeof input === 'string' ? input : JSON.stringify(input));

      // Step 1: retrieve relevant chunks
      const retrieved = await kb.query({ kbId, question, topK: config.top_k || 5, model: config.model });
      const context = retrieved.chunks.map((c, i) => `[Source ${i + 1}]: ${c.text}`).join('\n\n');

      // Step 2: generate answer with retrieved context
      const systemPrompt = config.system_prompt || 'Answer the question using only the provided context. If the answer is not in the context, say so.';
      const userPrompt = `Context:\n${context}\n\nQuestion: ${question}`;

      const response = await ctx.llmClient.chatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: ctx.agent?.model_id || 'default',
        temperature: config.temperature || 0.3,
      });

      const tokens = response.usage ? (response.usage.total_tokens || 0) : 0;
      return {
        answer: response.choices?.[0]?.message?.content || response.message?.content || '',
        sources: retrieved.chunks,
        question,
        _tokens: tokens,
      };
    }

    // ── Browser & Scraping Nodes ──────
    case 'scrape_webpage': {
      const scraper = require('./integrations/web-scraper');
      const url = config.url || (typeof input === 'string' ? input : input?.url);
      if (!url) throw new Error('scrape_webpage: url required');
      return scraper.actions.scrape_url({ url, selector: config.selector }, config);
    }

    case 'browser_navigate': {
      const browser = require('./integrations/browser');
      const url = config.url || (typeof input === 'string' ? input : input?.url);
      if (!url) throw new Error('browser_navigate: url required');
      return browser.actions.navigate({ url, wait_for: config.wait_for }, config);
    }

    case 'browser_action': {
      const browser = require('./integrations/browser');
      const actionType = config.action_type;
      if (!actionType) throw new Error('browser_action: action_type required');
      const action = browser.actions[actionType];
      if (!action) throw new Error(`browser_action: unknown action "${actionType}"`);
      return action(config.params || input || {}, config);
    }

    default:
      return { warning: `Unknown node type: ${nodeType}`, input };
  }
}

// ─── AI Node ────────────────────────────────────────────────
async function aiNode(systemPrompt, input, config, ctx) {
  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

  const response = await ctx.llmClient.chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputStr },
    ],
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 2048,
  });

  const content = response.choices?.[0]?.message?.content || '';
  const tokens = response.usage?.total_tokens || 0;

  // Try to parse JSON if it looks like JSON
  let parsed = content;
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    try { parsed = JSON.parse(content); } catch (_) { /* keep as string */ }
  }

  return { data: parsed, raw: content, _tokens: tokens };
}

// ─── Transform (sandboxed JS) ───────────────────────────────
function executeTransform(code, input) {
  const sandbox = { input, result: undefined, JSON, Math, Date, parseInt, parseFloat, String, Number, Array, Object };
  const script = new vm.Script(`result = (function() { ${code} })()`);
  const context = vm.createContext(sandbox);
  script.runInContext(context, { timeout: 2000 });
  return sandbox.result;
}

// ─── Action Node ────────────────────────────────────────────
async function executeAction(toolName, args, input, ctx) {
  // Interpolate input into args where needed
  if (args.body === '' && input) {
    args.body = typeof input === 'string' ? input : JSON.stringify(input);
  }

  const result = await ctx.toolRegistry.execute(toolName, args, {
    runId: ctx.runId,
    agentId: ctx.agent.id,
  });

  if (result.error) {
    throw new Error(`Tool ${toolName} failed: ${result.error}`);
  }
  return result.result;
}

// ─── If/Else ────────────────────────────────────────────────
function executeIfElse(config, input) {
  const value = resolveField(input, config.condition);
  const compareValue = config.value;
  let result = false;

  switch (config.operator) {
    case 'equals':       result = String(value) === String(compareValue); break;
    case 'not_equals':   result = String(value) !== String(compareValue); break;
    case 'contains':     result = String(value).includes(String(compareValue)); break;
    case 'greater_than': result = Number(value) > Number(compareValue); break;
    case 'less_than':    result = Number(value) < Number(compareValue); break;
    case 'is_empty':     result = value == null || value === '' || (Array.isArray(value) && value.length === 0); break;
    case 'is_not_empty': result = value != null && value !== '' && !(Array.isArray(value) && value.length === 0); break;
    default:             result = !!value;
  }

  return { data: input, _branch: result ? 'true' : 'false' };
}

// ─── Loop ───────────────────────────────────────────────────
function executeLoop(config, input) {
  const maxIter = Math.min(config.maxIterations || 100, 100);
  let items = input;

  // Handle wrapped input
  if (input && input.data) items = input.data;
  if (!Array.isArray(items)) items = [items];
  items = items.slice(0, maxIter);

  // Loop outputs each item on "item" handle, and collected results on "done"
  // Since we execute topologically, we output the full list and let downstream nodes handle it.
  // For now: output all items. True subgraph iteration is a future enhancement.
  return { items, count: items.length, _branch: 'done' };
}

// ─── Filter ─────────────────────────────────────────────────
function executeFilter(config, input) {
  let items = input;
  if (input && input.data) items = input.data;
  if (!Array.isArray(items)) items = [items];

  const passed = [];
  const failed = [];

  for (const item of items) {
    const value = resolveField(item, config.field);
    let matches = false;

    switch (config.operator) {
      case 'equals':       matches = String(value) === String(config.value); break;
      case 'not_equals':   matches = String(value) !== String(config.value); break;
      case 'contains':     matches = String(value).includes(String(config.value)); break;
      case 'greater_than': matches = Number(value) > Number(config.value); break;
      case 'less_than':    matches = Number(value) < Number(config.value); break;
      default:             matches = !!value;
    }

    if (matches) passed.push(item);
    else failed.push(item);
  }

  // Route: pass handle gets passed items, fail handle gets failed items
  // Use _multiOutput so gatherInput routes by handle key
  return { pass: passed, fail: failed, _multiOutput: true };
}

// ─── Merge ──────────────────────────────────────────────────
function executeMerge(config, input) {
  // Input is already merged from gatherInput (keyed by handle: { a: ..., b: ... })
  if (!input || typeof input !== 'object') return input;

  const a = input.a;
  const b = input.b;

  switch (config.mode) {
    case 'append':
      return { data: [].concat(a || []).concat(b || []) };
    case 'zip': {
      const arrA = Array.isArray(a) ? a : [a];
      const arrB = Array.isArray(b) ? b : [b];
      const zipped = arrA.map((item, i) => ({ a: item, b: arrB[i] }));
      return { data: zipped };
    }
    case 'combine':
    default:
      return { data: { a, b } };
  }
}

// ─── Helpers ────────────────────────────────────────────────
function resolveField(obj, fieldPath) {
  if (!fieldPath || !obj) return obj;
  const parts = fieldPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function logNode(dbRun, db, runId, nodeId, level, message, data = {}) {
  try {
    dbRun(db, `
      INSERT INTO run_logs (run_id, node_id, level, message, data, timestamp)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [runId, nodeId, level, message, JSON.stringify(data)]);
  } catch (_) { /* don't fail workflow on log errors */ }
}

// Strip internal metadata keys from outputs
function cleanOutput(output) {
  if (output == null || typeof output !== 'object') return output;
  if (Array.isArray(output)) return output;
  const { _branch, _branchKey, _error, _multiOutput, ...rest } = output;
  return Object.keys(rest).length === 0 ? output : rest;
}

module.exports = { executeWorkflow };
