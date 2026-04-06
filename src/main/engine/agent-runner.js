// ─── Agent Runner ───────────────────────────────────────────
// Executes an agent: system prompt → LLM → tool calls → response loop.
// Manages the full lifecycle: create run → execute → log → complete/error.

const { v4: uuid } = require('uuid');
const toolRegistry = require('./tool-registry');
const { createClient } = require('./llm-client');
const { registerAll } = require('./tools');
const { executeWorkflow } = require('./workflow-engine');

// Register all built-in tools
registerAll(toolRegistry);

// ─── Active Runs ────────────────────────────────────────────
const _activeRuns = new Map(); // runId → { cancel: Function, agentId, status }

// ─── Event Emitter ──────────────────────────────────────────
const EventEmitter = require('events');
const events = new EventEmitter();

// ─── Run an Agent ───────────────────────────────────────────
async function executeAgent(agentConfig, triggerData = {}, { dbAll, dbGet, dbRun, getDb, log }) {
  const runId = uuid();
  const agentId = agentConfig.id;
  let cancelled = false;

  // Register this run
  _activeRuns.set(runId, {
    agentId,
    status: 'running',
    cancel: () => { cancelled = true; },
  });

  events.emit('run-started', { runId, agentId });

  const db = await getDb();

  // Create run record
  dbRun(db, `
    INSERT INTO runs (id, agent_id, status, trigger_data, started_at)
    VALUES (?, ?, 'running', ?, datetime('now'))
  `, [runId, agentId, JSON.stringify(triggerData)]);

  // Log helper
  const logStep = (level, message, data = {}, nodeId = null) => {
    log(level, 'RUNNER', `[${agentId}/${runId.slice(0, 8)}] ${message}`, data);
    const timestamp = new Date().toISOString();
    try {
      dbRun(db, `
        INSERT INTO run_logs (run_id, node_id, level, message, data, timestamp)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [runId, nodeId, level, message, JSON.stringify(data)]);
    } catch (err) {
      log('error', 'RUNNER', `[${agentId}/${runId.slice(0, 8)}] Failed to persist run log`, {
        error: err.message,
      });
    }
    events.emit('run-step', { runId, agentId, step: { level, message, data, nodeId, timestamp } });
  };

  try {
    logStep('info', 'Run started', { trigger: triggerData });

    // ─── Check for Workflow Mode ────────────────────────
    const agentNodes = JSON.parse(agentConfig.nodes || '[]');
    if (agentNodes.length > 0) {
      logStep('info', `Workflow mode: ${agentNodes.length} nodes detected`);

      // Resolve LLM config for workflow AI nodes
      const modelId = agentConfig.model_id || '';
      let llmConfig = { baseUrl: 'http://localhost:11434/v1', defaultModel: '' };
      if (modelId) {
        const model = dbGet(db, 'SELECT * FROM models WHERE id = ?', [modelId]);
        if (model) {
          llmConfig = {
            baseUrl: model.model_path || llmConfig.baseUrl,
            apiKey: model.api_key_encrypted || '',
            defaultModel: model.name,
          };
        }
      }
      const llmClient = createClient(llmConfig);

      const wfResult = await executeWorkflow(agentConfig, triggerData, {
        runId, db, dbRun, log, llmClient, toolRegistry,
        cancelCheck: () => cancelled,
      });

      const finalStatus = cancelled ? 'cancelled' : wfResult.status;

      dbRun(db, `
        UPDATE runs SET status = ?, result = ?, tokens_used = ?,
        duration_ms = (strftime('%s','now') - strftime('%s',started_at)) * 1000,
        completed_at = datetime('now') WHERE id = ?
      `, [finalStatus, JSON.stringify(wfResult.output), wfResult.tokens, runId]);

      _activeRuns.delete(runId);
      events.emit('run-completed', { runId, agentId, status: finalStatus, result: wfResult.output });

      return {
        runId,
        status: finalStatus,
        result: wfResult.output,
        tokens: wfResult.tokens,
        nodeCount: wfResult.nodeCount,
        errors: wfResult.errors,
      };
    }

    // ─── Simple LLM Loop Mode ───────────────────────────
    // Parse agent config
    const systemPrompt = agentConfig.system_prompt || 'You are a helpful AI agent.';
    const temperature = agentConfig.temperature || 0.7;
    const tokenBudget = agentConfig.token_budget || 4096;
    const maxRetries = agentConfig.max_retries || 3;
    const modelId = agentConfig.model_id || '';

    // Resolve model configuration
    let llmConfig = { baseUrl: 'http://localhost:11434/v1', defaultModel: '' };
    if (modelId) {
      const model = dbGet(db, 'SELECT * FROM models WHERE id = ?', [modelId]);
      if (model) {
        llmConfig = {
          baseUrl: model.model_path || llmConfig.baseUrl,
          apiKey: model.api_key_encrypted || '',
          defaultModel: model.name,
        };
      }
    }

    const llm = createClient(llmConfig);
    let tools = toolRegistry.toOpenAITools();

    // Build initial messages
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add trigger data as user message
    const triggerMessage = triggerData.message || triggerData.prompt || 
      `Agent triggered. Trigger type: ${agentConfig.trigger_type}. Trigger data: ${JSON.stringify(triggerData)}`;
    messages.push({ role: 'user', content: triggerMessage });

    logStep('info', 'Calling LLM', { model: llmConfig.defaultModel, tools: tools.length });

    // ─── Execution Loop ─────────────────────────────────────
    let totalTokens = 0;
    let iterations = 0;
    const maxIterations = 10; // Safety limit
    let finalResult = null;

    while (iterations < maxIterations && !cancelled) {
      iterations++;
      logStep('info', `Iteration ${iterations}`, { messageCount: messages.length });

      // Call LLM
      let response;
      try {
        response = await llm.chatCompletion({
          messages,
          tools: tools.length > 0 ? tools : undefined,
          temperature,
          maxTokens: tokenBudget,
        });
      } catch (err) {
        // If the endpoint rejects the tool schema, optionally retry without tools.
        if (err.message.includes('does not support tools') && tools.length > 0) {
          const allowToolFallback = agentConfig.allowToolFallback === true || agentConfig.allow_tool_fallback === true;
          const modelName = llmConfig.defaultModel || 'selected model';
          if (!allowToolFallback) {
            const compatibilityError = new Error(
              `Tool calling failed for model ${modelName} at the configured endpoint. This does not prove the model itself lacks tool support; the endpoint or compatibility layer may have rejected the tool schema.`
            );
            logStep('error', compatibilityError.message, { originalError: err.message });
            throw compatibilityError;
          }
          logStep('warn', 'Tool calling request was rejected; retrying without tools', {
            model: modelName,
            originalError: err.message,
          });
          tools = []; // Disable tools for remaining iterations
          try {
            response = await llm.chatCompletion({ messages, temperature, maxTokens: tokenBudget });
          } catch (retryErr) {
            logStep('error', `LLM call failed (no tools): ${retryErr.message}`);
            throw retryErr;
          }
        } else {
          logStep('error', `LLM call failed: ${err.message}`);
          if (iterations <= maxRetries) {
            logStep('info', `Retrying (${iterations}/${maxRetries})`);
            continue;
          }
          throw err;
        }
      }

      // Track tokens
      if (response.usage) {
        totalTokens += response.usage.total_tokens || 0;
      }

      const choice = response.choices?.[0];
      if (!choice) {
        throw new Error('No response from LLM');
      }

      const assistantMsg = choice.message;
      messages.push(assistantMsg);

      // Check for tool calls
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        logStep('info', `${assistantMsg.tool_calls.length} tool call(s)`, {
          tools: assistantMsg.tool_calls.map((tc) => tc.function.name),
        });

        for (const toolCall of assistantMsg.tool_calls) {
          if (cancelled) break;

          const toolName = toolCall.function.name;
          let toolArgs = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (_) {}

          logStep('info', `Executing tool: ${toolName}`, { args: toolArgs }, toolName);

          const toolResult = await toolRegistry.execute(toolName, toolArgs, { runId, agentId });

          const resultStr = JSON.stringify(toolResult.error ? { error: toolResult.error } : toolResult.result);

          logStep(
            toolResult.error ? 'warn' : 'info',
            `Tool result: ${toolName}`,
            { result: resultStr.slice(0, 500) },
            toolName
          );

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultStr.slice(0, 10000),
          });
        }

        // Continue loop to let LLM process tool results
        continue;
      }

      // No tool calls — LLM is done
      finalResult = assistantMsg.content;
      logStep('info', 'LLM completed', { tokens: totalTokens, iterations });
      break;
    }

    if (cancelled) {
      logStep('warn', 'Run cancelled');
      dbRun(db, `
        UPDATE runs SET status = 'cancelled', result = ?, tokens_used = ?,
        duration_ms = (strftime('%s','now') - strftime('%s',started_at)) * 1000,
        completed_at = datetime('now') WHERE id = ?
      `, [JSON.stringify({ output: finalResult }), totalTokens, runId]);
      _activeRuns.delete(runId);
      events.emit('run-completed', { runId, agentId, status: 'cancelled' });
      return { runId, status: 'cancelled' };
    }

    // Success
    dbRun(db, `
      UPDATE runs SET status = 'completed', result = ?, tokens_used = ?,
      duration_ms = (strftime('%s','now') - strftime('%s',started_at)) * 1000,
      completed_at = datetime('now') WHERE id = ?
    `, [JSON.stringify({ output: finalResult }), totalTokens, runId]);

    _activeRuns.delete(runId);
    events.emit('run-completed', { runId, agentId, status: 'completed', result: finalResult });

    return { runId, status: 'completed', result: finalResult, tokens: totalTokens };

  } catch (err) {
    logStep('error', `Run failed: ${err.message}`, { stack: err.stack });

    dbRun(db, `
      UPDATE runs SET status = 'error', error = ?, 
      duration_ms = (strftime('%s','now') - strftime('%s',started_at)) * 1000,
      completed_at = datetime('now') WHERE id = ?
    `, [err.message, runId]);

    _activeRuns.delete(runId);
    events.emit('run-completed', { runId, agentId, status: 'error', error: err.message });

    return { runId, status: 'error', error: err.message };
  }
}

// ─── Cancel a Run ───────────────────────────────────────────
function cancelRun(runId) {
  const run = _activeRuns.get(runId);
  if (run) {
    run.cancel();
    return true;
  }
  return false;
}

// ─── Get Active Runs ────────────────────────────────────────
function getActiveRuns() {
  return Array.from(_activeRuns.entries()).map(([id, r]) => ({
    id,
    agentId: r.agentId,
    status: r.status,
  }));
}

module.exports = { executeAgent, cancelRun, getActiveRuns, events, toolRegistry };
