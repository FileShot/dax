// ─── Crew Engine ────────────────────────────────────────────
// Orchestrates multi-agent collaboration
// Strategies: sequential, hierarchical (manager delegates)

'use strict';

const MAX_RECURSION = 5;

/**
 * Execute a crew — runs multiple agents together with shared context.
 * 
 * @param {Object} crew - { id, name, agents: [{id, role}], strategy, max_rounds }
 * @param {Object} triggerData - Initial input/prompt
 * @param {Object} helpers - { dbAll, dbGet, dbRun, getDb, log }
 * @returns {Object} { results, rounds, strategy, summary }
 */
async function executeCrew(crew, triggerData, helpers, depth = 0) {
  const { dbGet, log } = helpers;

  if (depth >= MAX_RECURSION) {
    throw new Error(`Crew recursion limit (${MAX_RECURSION}) exceeded`);
  }

  const agentConfigs = typeof crew.agents === 'string' ? JSON.parse(crew.agents) : (crew.agents || []);
  if (agentConfigs.length === 0) throw new Error('Crew has no agents');

  const strategy = crew.strategy || 'sequential';
  const maxRounds = crew.max_rounds || 10;

  log('info', 'CREW', `Executing crew "${crew.name}" with ${agentConfigs.length} agents, strategy: ${strategy}`);

  // Resolve agent records from DB
  const db = await helpers.getDb();
  const agents = [];
  for (const cfg of agentConfigs) {
    const agent = dbGet(db, 'SELECT * FROM agents WHERE id = ?', [cfg.id]);
    if (!agent) {
      log('warn', 'CREW', `Agent ${cfg.id} not found, skipping`);
      continue;
    }
    agents.push({ ...agent, role: cfg.role || agent.name });
  }

  if (agents.length === 0) throw new Error('No valid agents found in crew');

  const { executeAgent } = require('./agent-runner');

  if (strategy === 'sequential') {
    return executeSequential(agents, triggerData, helpers, executeAgent, maxRounds, crew, log);
  } else if (strategy === 'hierarchical') {
    return executeHierarchical(agents, triggerData, helpers, executeAgent, maxRounds, crew, log);
  } else {
    throw new Error(`Unknown crew strategy: ${strategy}`);
  }
}

/**
 * Sequential strategy: Each agent runs in order, passing output to the next.
 * Runs up to max_rounds complete cycles.
 */
async function executeSequential(agents, triggerData, helpers, executeAgent, maxRounds, crew, log) {
  const results = [];
  let currentInput = triggerData;
  let rounds = 0;

  for (let round = 0; round < maxRounds; round++) {
    rounds++;
    let roundResults = [];

    for (const agent of agents) {
      const trigger = {
        trigger: 'crew',
        crew_id: crew.id,
        crew_name: crew.name,
        role: agent.role,
        round: round + 1,
        message: typeof currentInput === 'string' ? currentInput :
                 currentInput?.result || currentInput?.message || JSON.stringify(currentInput),
        previous_results: roundResults,
      };

      try {
        const result = await executeAgent(agent, trigger, helpers);
        const output = {
          agent_id: agent.id,
          agent_name: agent.name,
          role: agent.role,
          round: round + 1,
          result: result,
        };
        roundResults.push(output);
        currentInput = result;
      } catch (err) {
        log('error', 'CREW', `Agent "${agent.name}" failed in round ${round + 1}`, { error: err.message });
        roundResults.push({
          agent_id: agent.id,
          agent_name: agent.name,
          role: agent.role,
          round: round + 1,
          error: err.message,
        });
      }
    }

    results.push(...roundResults);

    // Check if the last result signals completion
    const lastResult = roundResults[roundResults.length - 1]?.result;
    if (lastResult && typeof lastResult === 'object' && lastResult.crew_done === true) {
      log('info', 'CREW', `Crew "${crew.name}" completed after ${rounds} rounds (agent signaled done)`);
      break;
    }

    // Only run 1 round by default in sequential unless agents emit crew_done
    if (round === 0 && !crew.loop) break;
  }

  return {
    crew_id: crew.id,
    crew_name: crew.name,
    strategy: 'sequential',
    rounds,
    agent_count: agents.length,
    results,
    final_output: results[results.length - 1]?.result || null,
  };
}

/**
 * Hierarchical strategy: First agent is the manager, decides which agents to delegate to.
 * Manager gets all agent descriptions and decides delegation order.
 */
async function executeHierarchical(agents, triggerData, helpers, executeAgent, maxRounds, crew, log) {
  const [manager, ...workers] = agents;
  const results = [];
  let rounds = 0;

  // Build worker descriptions for the manager
  const workerDescriptions = workers.map((w) => 
    `- ${w.role} (${w.name}): ${w.description || 'No description'}`
  ).join('\n');

  for (let round = 0; round < maxRounds; round++) {
    rounds++;

    // Manager decides what to do
    const managerTrigger = {
      trigger: 'crew_manager',
      crew_id: crew.id,
      crew_name: crew.name,
      role: 'manager',
      round: round + 1,
      message: round === 0 ?
        `You are the manager of a team. Your job is to coordinate the following workers to accomplish the task.\n\nWorkers:\n${workerDescriptions}\n\nTask: ${triggerData.message || triggerData.prompt || JSON.stringify(triggerData)}\n\nRespond with JSON: {"delegate_to": "worker_role", "instructions": "what to do", "done": false}\nOr if done: {"done": true, "final_answer": "..."}` :
        `Round ${round + 1}. Previous results:\n${JSON.stringify(results.slice(-workers.length))}\n\nDecide next step. Respond with JSON: {"delegate_to": "worker_role", "instructions": "...", "done": false} or {"done": true, "final_answer": "..."}`,
      previous_results: results,
    };

    let managerResult;
    try {
      managerResult = await executeAgent(manager, managerTrigger, helpers);
    } catch (err) {
      log('error', 'CREW', `Manager agent failed`, { error: err.message });
      break;
    }

    results.push({
      agent_id: manager.id,
      agent_name: manager.name,
      role: 'manager',
      round: round + 1,
      result: managerResult,
    });

    // Parse manager's decision
    let decision;
    try {
      const text = typeof managerResult === 'string' ? managerResult :
                   managerResult?.result || managerResult?.output || JSON.stringify(managerResult);
      // Extract JSON from potential markdown code blocks
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      decision = jsonMatch ? JSON.parse(jsonMatch[0]) : { done: true, final_answer: text };
    } catch (_) {
      decision = { done: true, final_answer: String(managerResult) };
    }

    if (decision.done) {
      log('info', 'CREW', `Manager declared task complete after ${rounds} rounds`);
      results.push({
        agent_id: 'manager-decision',
        round: round + 1,
        result: { final_answer: decision.final_answer },
      });
      break;
    }

    // Delegate to worker
    if (decision.delegate_to) {
      const worker = workers.find((w) => w.role === decision.delegate_to || w.name === decision.delegate_to);
      if (worker) {
        const workerTrigger = {
          trigger: 'crew_delegation',
          crew_id: crew.id,
          delegated_by: manager.name,
          instructions: decision.instructions,
          message: decision.instructions,
          round: round + 1,
        };

        try {
          const workerResult = await executeAgent(worker, workerTrigger, helpers);
          results.push({
            agent_id: worker.id,
            agent_name: worker.name,
            role: worker.role,
            round: round + 1,
            result: workerResult,
          });
        } catch (err) {
          results.push({
            agent_id: worker.id,
            agent_name: worker.name,
            role: worker.role,
            round: round + 1,
            error: err.message,
          });
        }
      } else {
        log('warn', 'CREW', `Manager delegated to unknown worker: ${decision.delegate_to}`);
      }
    }
  }

  return {
    crew_id: crew.id,
    crew_name: crew.name,
    strategy: 'hierarchical',
    rounds,
    manager: manager.name,
    worker_count: workers.length,
    results,
    final_output: results[results.length - 1]?.result || null,
  };
}

module.exports = { executeCrew };
