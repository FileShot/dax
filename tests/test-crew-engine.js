// ─── Crew Engine Tests ──────────────────────────────────────
// Tests crew-engine.js: sequential & hierarchical strategies,
// error handling, recursion depth, edge cases.
// Uses module-level mocking for agent-runner.

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    results.push(`  FAIL  ${name}: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    results.push(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    results.push(`  FAIL  ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ─── Mock agent-runner before requiring crew-engine ─────────
// The crew engine does require('./agent-runner') internally

const path = require('path');
const agentRunnerPath = path.resolve(__dirname, '../src/main/engine/agent-runner.js');

// Store mock execute function that tests can swap
let mockExecuteAgent = async (agent, triggerData, helpers) => {
  return { result: `Output from ${agent.name}`, tokens: { total: 10 } };
};

// Install mock in require cache
require.cache[require.resolve(agentRunnerPath)] = {
  id: agentRunnerPath,
  filename: agentRunnerPath,
  loaded: true,
  exports: {
    executeAgent: (...args) => mockExecuteAgent(...args),
    cancelRun: () => {},
    getActiveRuns: () => [],
    events: { on: () => {}, emit: () => {} },
    toolRegistry: { register: () => {} },
  },
};

const { executeCrew } = require('../src/main/engine/crew-engine');

// ─── Mock helpers ───────────────────────────────────────────

function mockAgent(id, name, desc) {
  return { id, name, description: desc || `Agent ${name}`, system_prompt: `You are ${name}` };
}

function mockHelpers(agentMap) {
  return {
    dbAll: () => [],
    dbGet: (db, sql, params) => {
      const id = Array.isArray(params) ? params[0] : params;
      return agentMap[id] || null;
    },
    dbRun: () => {},
    getDb: async () => ({}),
    log: () => {},
  };
}

async function run() {
  console.log('\n========================================');
  console.log('  DAX CREW ENGINE TESTS');
  console.log('========================================\n');

  // ════════════════════════════════════════════════════════
  // 1. SEQUENTIAL STRATEGY
  // ════════════════════════════════════════════════════════
  console.log('--- Sequential Strategy ---');

  await testAsync('Crew: sequential runs agents in order', async () => {
    const a1 = mockAgent('a1', 'Writer');
    const a2 = mockAgent('a2', 'Editor');
    const agentMap = { a1, a2 };
    const executionOrder = [];

    mockExecuteAgent = async (agent, trigger) => {
      executionOrder.push(agent.id);
      return { result: `Output from ${agent.name}` };
    };

    const helpers = mockHelpers(agentMap);
    const crew = {
      id: 'crew-1',
      name: 'Writing Team',
      agents: [{ id: 'a1', role: 'Writer' }, { id: 'a2', role: 'Editor' }],
      strategy: 'sequential',
      max_rounds: 3,
    };

    const result = await executeCrew(crew, { message: 'Write an article' }, helpers);
    assertEqual(result.crew_id, 'crew-1');
    assertEqual(result.crew_name, 'Writing Team');
    assertEqual(result.strategy, 'sequential');
    assert(result.results.length >= 2, `Expected 2+ results, got ${result.results.length}`);
    assertEqual(executionOrder[0], 'a1', 'Writer should run first');
    assertEqual(executionOrder[1], 'a2', 'Editor should run second');
  });

  await testAsync('Crew: sequential passes output to next agent', async () => {
    const a1 = mockAgent('a1', 'Step1');
    const a2 = mockAgent('a2', 'Step2');
    let step2Input = null;

    mockExecuteAgent = async (agent, trigger) => {
      if (agent.id === 'a2') step2Input = trigger;
      if (agent.id === 'a1') return { result: 'step1-output' };
      return { result: 'step2-output' };
    };

    const helpers = mockHelpers({ a1, a2 });
    const crew = {
      id: 'crew-2',
      name: 'Pipeline',
      agents: [{ id: 'a1', role: 'Step1' }, { id: 'a2', role: 'Step2' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    await executeCrew(crew, { message: 'Start' }, helpers);
    assert(step2Input, 'Step2 should have received input');
    assert(step2Input.message || step2Input.previous_results,
      'Step2 should receive previous output');
  });

  await testAsync('Crew: sequential early exit on crew_done (after round)', async () => {
    const a1 = mockAgent('a1', 'First');
    const a2 = mockAgent('a2', 'Second');
    let round2Called = false;

    mockExecuteAgent = async (agent, trigger) => {
      // crew_done is checked on the LAST agent's result after a full round
      if (trigger.round === 2) { round2Called = true; }
      if (agent.id === 'a2') return { result: 'done', crew_done: true };
      return { result: 'ok' };
    };

    const helpers = mockHelpers({ a1, a2 });
    const crew = {
      id: 'crew-3',
      name: 'Early Exit',
      agents: [{ id: 'a1', role: 'First' }, { id: 'a2', role: 'Second' }],
      strategy: 'sequential',
      max_rounds: 5,
      loop: true, // Enable multi-round looping
    };

    const result = await executeCrew(crew, { message: 'Go' }, helpers);
    // crew_done should stop after round 1, no round 2
    assert(!round2Called, 'Round 2 should not have been reached');
    assertEqual(result.rounds, 1, 'Should complete in 1 round');
  });

  await testAsync('Crew: sequential returns final_output', async () => {
    const a1 = mockAgent('a1', 'Worker');
    mockExecuteAgent = async () => ({ result: 'final answer' });

    const helpers = mockHelpers({ a1 });
    const crew = {
      id: 'crew-4',
      name: 'Solo',
      agents: [{ id: 'a1', role: 'Worker' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    const result = await executeCrew(crew, { message: 'Do it' }, helpers);
    assert(result.final_output !== undefined, 'Should have final_output');
  });

  // ════════════════════════════════════════════════════════
  // 2. HIERARCHICAL STRATEGY
  // ════════════════════════════════════════════════════════
  console.log('--- Hierarchical Strategy ---');

  await testAsync('Crew: hierarchical manager delegates to worker', async () => {
    const mgr = mockAgent('mgr', 'Manager', 'Coordinates tasks');
    const w1 = mockAgent('w1', 'Researcher', 'Researches topics');
    let workerCalled = false;
    let managerCalls = 0;

    mockExecuteAgent = async (agent, trigger) => {
      if (agent.id === 'mgr') {
        managerCalls++;
        if (managerCalls === 1) {
          return { result: JSON.stringify({ delegate_to: 'Researcher', instructions: 'Research AI trends', done: false }) };
        }
        return { result: JSON.stringify({ done: true, final_answer: 'All done' }) };
      }
      if (agent.id === 'w1') {
        workerCalled = true;
        return { result: 'Research complete' };
      }
      return { result: 'unknown' };
    };

    const helpers = mockHelpers({ mgr, w1 });
    const crew = {
      id: 'crew-5',
      name: 'Research Team',
      agents: [{ id: 'mgr', role: 'Manager' }, { id: 'w1', role: 'Researcher' }],
      strategy: 'hierarchical',
      max_rounds: 5,
    };

    const result = await executeCrew(crew, { message: 'Research AI' }, helpers);
    assertEqual(result.strategy, 'hierarchical');
    assert(workerCalled, 'Worker should have been called');
  });

  await testAsync('Crew: hierarchical stops when manager says done', async () => {
    const mgr = mockAgent('mgr', 'Manager');
    const w1 = mockAgent('w1', 'Worker');
    let managerCalls = 0;

    mockExecuteAgent = async (agent) => {
      if (agent.id === 'mgr') {
        managerCalls++;
        return { result: JSON.stringify({ done: true, final_answer: 'Finished' }) };
      }
      return { result: 'never called' };
    };

    const helpers = mockHelpers({ mgr, w1 });
    const crew = {
      id: 'crew-6',
      name: 'Quick Done',
      agents: [{ id: 'mgr', role: 'Manager' }, { id: 'w1', role: 'Worker' }],
      strategy: 'hierarchical',
      max_rounds: 10,
    };

    const result = await executeCrew(crew, { message: 'Quick task' }, helpers);
    assertEqual(managerCalls, 1, 'Manager should be called once');
    assertEqual(result.rounds, 1, 'Should complete in 1 round');
  });

  await testAsync('Crew: hierarchical bad JSON from manager treated as final', async () => {
    const mgr = mockAgent('mgr', 'Manager');
    const w1 = mockAgent('w1', 'Worker');

    mockExecuteAgent = async (agent) => {
      if (agent.id === 'mgr') return { result: 'This is not JSON, just a plain text answer.' };
      return { result: 'never called' };
    };

    const helpers = mockHelpers({ mgr, w1 });
    const crew = {
      id: 'crew-7',
      name: 'Bad JSON',
      agents: [{ id: 'mgr', role: 'Manager' }, { id: 'w1', role: 'Worker' }],
      strategy: 'hierarchical',
      max_rounds: 5,
    };

    const result = await executeCrew(crew, { message: 'Test' }, helpers);
    assert(result.results.length >= 1, 'Should have at least 1 result');
  });

  // ════════════════════════════════════════════════════════
  // 3. ERROR HANDLING
  // ════════════════════════════════════════════════════════
  console.log('--- Error Handling ---');

  await testAsync('Crew: agent failure recorded in results', async () => {
    const a1 = mockAgent('a1', 'Failer');

    mockExecuteAgent = async () => { throw new Error('Agent exploded'); };

    const helpers = mockHelpers({ a1 });
    const crew = {
      id: 'crew-8',
      name: 'Fail Crew',
      agents: [{ id: 'a1', role: 'Failer' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    const result = await executeCrew(crew, { message: 'Fail' }, helpers);
    const errorResult = result.results.find(r => r.error);
    assert(errorResult, 'Should have an error result');
    assert(errorResult.error.includes('exploded'), 'Error should mention exploded');
  });

  await testAsync('Crew: missing agent in DB is skipped', async () => {
    const a1 = mockAgent('a1', 'Exists');
    // a2 is NOT in the agentMap
    mockExecuteAgent = async () => ({ result: 'ok' });

    const helpers = mockHelpers({ a1 });
    const crew = {
      id: 'crew-9',
      name: 'Missing Agent',
      agents: [{ id: 'a1', role: 'Exists' }, { id: 'a2', role: 'Ghost' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    const result = await executeCrew(crew, { message: 'Test' }, helpers);
    assert(result.results.length >= 1, 'Should have at least 1 result');
  });

  await testAsync('Crew: recursion depth limit enforced', async () => {
    const a1 = mockAgent('a1', 'Worker');
    mockExecuteAgent = async () => ({ result: 'ok' });
    const helpers = mockHelpers({ a1 });

    const crew = {
      id: 'crew-10',
      name: 'Deep Crew',
      agents: [{ id: 'a1', role: 'Worker' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    try {
      await executeCrew(crew, { message: 'Deep' }, helpers, 10);
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('recursion') || err.message.includes('depth') || err.message.includes('MAX') || err.message.includes('limit'),
        `Expected recursion error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 4. RESULT STRUCTURE
  // ════════════════════════════════════════════════════════
  console.log('--- Result Structure ---');

  await testAsync('Crew: result has all expected fields', async () => {
    const a1 = mockAgent('a1', 'Worker');
    mockExecuteAgent = async () => ({ result: 'done' });
    const helpers = mockHelpers({ a1 });

    const crew = {
      id: 'crew-11',
      name: 'Structure Test',
      agents: [{ id: 'a1', role: 'Worker' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    const result = await executeCrew(crew, { message: 'Test' }, helpers);
    assert(result.crew_id, 'Should have crew_id');
    assert(result.crew_name, 'Should have crew_name');
    assert(result.strategy, 'Should have strategy');
    assert(result.rounds !== undefined, 'Should have rounds');
    assert(Array.isArray(result.results), 'Should have results array');
  });

  await testAsync('Crew: each result entry has agent info', async () => {
    const a1 = mockAgent('a1', 'WorkerA');
    const a2 = mockAgent('a2', 'WorkerB');
    mockExecuteAgent = async (agent) => ({ result: `Output from ${agent.name}` });

    const helpers = mockHelpers({ a1, a2 });
    const crew = {
      id: 'crew-12',
      name: 'Info Check',
      agents: [{ id: 'a1', role: 'WorkerA' }, { id: 'a2', role: 'WorkerB' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    const result = await executeCrew(crew, { message: 'Test' }, helpers);
    for (const entry of result.results) {
      if (entry.error && !entry.agent_id) continue;
      assert(entry.agent_id || entry.agent_name || entry.role, 'Each result should identify the agent');
      assert(entry.round !== undefined, 'Each result should have round number');
    }
  });

  // ════════════════════════════════════════════════════════
  // 5. EDGE CASES
  // ════════════════════════════════════════════════════════
  console.log('--- Edge Cases ---');

  await testAsync('Crew: max_rounds = 1 limits execution', async () => {
    const a1 = mockAgent('a1', 'Worker');
    let callCount = 0;

    mockExecuteAgent = async () => { callCount++; return { result: 'done' }; };

    const helpers = mockHelpers({ a1 });
    const crew = {
      id: 'crew-13',
      name: 'One Round',
      agents: [{ id: 'a1', role: 'Worker' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    await executeCrew(crew, { message: 'Go' }, helpers);
    assert(callCount <= 2, `Should not call agent more than max_rounds times, got ${callCount}`);
  });

  await testAsync('Crew: single agent crew works', async () => {
    const solo = mockAgent('solo', 'Solo Agent');
    mockExecuteAgent = async () => ({ result: 'solo result' });

    const helpers = mockHelpers({ solo });
    const crew = {
      id: 'crew-14',
      name: 'Solo Crew',
      agents: [{ id: 'solo', role: 'Solo Agent' }],
      strategy: 'sequential',
      max_rounds: 1,
    };

    const result = await executeCrew(crew, { message: 'Solo task' }, helpers);
    assert(result.results.length >= 1, 'Should have at least 1 result');
  });

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('\n========================================');
  console.log('  RESULTS');
  console.log('========================================\n');
  for (const r of results) console.log(r);
  console.log(`\n  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================\n');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
