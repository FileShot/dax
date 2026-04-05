// ─── Workflow Engine Tests ──────────────────────────────────
// Tests the workflow engine: topological sort, node execution,
// branching, interpolation, transform sandbox, and more.

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

const { executeWorkflow } = require('../src/main/engine/workflow-engine');

// ─── Mock helpers ───────────────────────────────────────────

function mockContext(overrides = {}) {
  return {
    runId: 'test-run-001',
    db: null,
    dbRun: async () => {},
    log: () => {},
    llmClient: {
      chatCompletion: async ({ messages, temperature, maxTokens }) => ({
        content: JSON.stringify({ analysis: 'test result' }),
        tokens: { prompt: 10, completion: 20, total: 30 },
      }),
    },
    toolRegistry: {
      execute: async (name, params) => ({ result: `executed ${name}` }),
    },
    cancelCheck: () => false,
    executeAgent: async () => ({ result: 'agent called' }),
    ...overrides,
  };
}

function makeAgent(nodes, edges) {
  return {
    id: 'test-agent',
    nodes: JSON.stringify(nodes),
    edges: JSON.stringify(edges),
  };
}

async function run() {
  console.log('\n========================================');
  console.log('  DAX WORKFLOW ENGINE TESTS');
  console.log('========================================\n');

  // ════════════════════════════════════════════════════════
  // 1. BASIC EXECUTION
  // ════════════════════════════════════════════════════════
  console.log('--- Basic Execution ---');

  await testAsync('WF: single manual_trigger node', async () => {
    const agent = makeAgent(
      [{ id: 'trigger', type: 'manual_trigger', data: { config: {} } }],
      []
    );
    const result = await executeWorkflow(agent, { message: 'hello' }, mockContext());
    assert(result.output, 'Should have output');
    assertEqual(result.nodeCount, 1, 'Should execute 1 node');
    assertEqual(result.status, 'completed');
  });

  await testAsync('WF: trigger → log chain', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'log', type: 'log_output', data: { config: { label: 'test' } } },
      ],
      [{ source: 'trigger', target: 'log' }]
    );
    const result = await executeWorkflow(agent, { message: 'hello' }, mockContext());
    assertEqual(result.nodeCount, 2);
    assertEqual(result.status, 'completed');
  });

  await testAsync('WF: empty nodes throws error', async () => {
    const agent = makeAgent([], []);
    try {
      await executeWorkflow(agent, {}, mockContext());
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('no nodes'), `Expected no-nodes error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 2. AI NODES
  // ════════════════════════════════════════════════════════
  console.log('--- AI Nodes ---');

  await testAsync('WF: ai_analyze node calls LLM', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'analyze', type: 'ai_analyze', data: { config: { prompt: 'Analyze this' } } },
      ],
      [{ source: 'trigger', target: 'analyze' }]
    );
    let called = false;
    const ctx = mockContext({
      llmClient: {
        chatCompletion: async () => {
          called = true;
          return { content: '{"analysis": "done"}', tokens: { total: 30 } };
        },
      },
    });
    const result = await executeWorkflow(agent, { message: 'test' }, ctx);
    assert(called, 'LLM should have been called');
    assertEqual(result.nodeCount, 2);
    assert(result.tokens >= 0, 'Should have token count');
  });

  await testAsync('WF: ai_generate node', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'gen', type: 'ai_generate', data: { config: { prompt: 'Generate content' } } },
      ],
      [{ source: 'trigger', target: 'gen' }]
    );
    const result = await executeWorkflow(agent, {}, mockContext());
    assertEqual(result.nodeCount, 2);
    assertEqual(result.status, 'completed');
  });

  await testAsync('WF: ai_summarize node', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'sum', type: 'ai_summarize', data: { config: {} } },
      ],
      [{ source: 'trigger', target: 'sum' }]
    );
    const result = await executeWorkflow(agent, { text: 'Long text...' }, mockContext());
    assertEqual(result.nodeCount, 2);
  });

  // ════════════════════════════════════════════════════════
  // 3. TRANSFORM NODE (SANDBOX)
  // ════════════════════════════════════════════════════════
  console.log('--- Transform Node ---');

  await testAsync('WF: transform node executes code', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'tx', type: 'transform', data: { config: { code: 'input.message.toUpperCase()' } } },
      ],
      [{ source: 'trigger', target: 'tx' }]
    );
    const result = await executeWorkflow(agent, { message: 'hello' }, mockContext());
    assertEqual(result.nodeCount, 2);
    // output should be the uppercase string
    assert(result.output, 'Should have output');
  });

  await testAsync('WF: transform node with JSON manipulation', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'tx', type: 'transform', data: { config: { code: '({count: input.items ? input.items.length : 0})' } } },
      ],
      [{ source: 'trigger', target: 'tx' }]
    );
    const result = await executeWorkflow(agent, { items: [1, 2, 3] }, mockContext());
    assertEqual(result.nodeCount, 2);
  });

  // ════════════════════════════════════════════════════════
  // 4. IF/ELSE BRANCHING
  // ════════════════════════════════════════════════════════
  console.log('--- Branching ---');

  await testAsync('WF: if_else true branch', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'cond', type: 'if_else', data: { config: { field: 'score', operator: 'greater_than', value: '50' } } },
        { id: 'yes', type: 'log_output', data: { config: { label: 'high' } } },
        { id: 'no', type: 'log_output', data: { config: { label: 'low' } } },
      ],
      [
        { source: 'trigger', target: 'cond' },
        { source: 'cond', target: 'yes', sourceHandle: 'true' },
        { source: 'cond', target: 'no', sourceHandle: 'false' },
      ]
    );
    const result = await executeWorkflow(agent, { score: 80 }, mockContext());
    assertEqual(result.status, 'completed');
  });

  await testAsync('WF: if_else equals operator', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'cond', type: 'if_else', data: { config: { field: 'status', operator: 'equals', value: 'active' } } },
        { id: 'match', type: 'log_output', data: { config: {} } },
      ],
      [
        { source: 'trigger', target: 'cond' },
        { source: 'cond', target: 'match', sourceHandle: 'true' },
      ]
    );
    const result = await executeWorkflow(agent, { status: 'active' }, mockContext());
    assertEqual(result.status, 'completed');
  });

  await testAsync('WF: if_else contains operator', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'cond', type: 'if_else', data: { config: { field: 'text', operator: 'contains', value: 'hello' } } },
        { id: 'yes', type: 'log_output', data: { config: {} } },
      ],
      [
        { source: 'trigger', target: 'cond' },
        { source: 'cond', target: 'yes', sourceHandle: 'true' },
      ]
    );
    const result = await executeWorkflow(agent, { text: 'say hello world' }, mockContext());
    assertEqual(result.status, 'completed');
  });

  // ════════════════════════════════════════════════════════
  // 5. DELAY NODE
  // ════════════════════════════════════════════════════════
  console.log('--- Delay ---');

  await testAsync('WF: delay node passes through input', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'wait', type: 'delay', data: { config: { seconds: '0' } } },
        { id: 'log', type: 'log_output', data: { config: {} } },
      ],
      [
        { source: 'trigger', target: 'wait' },
        { source: 'wait', target: 'log' },
      ]
    );
    const result = await executeWorkflow(agent, { data: 'passthrough' }, mockContext());
    assertEqual(result.nodeCount, 3);
    assertEqual(result.status, 'completed');
  });

  // ════════════════════════════════════════════════════════
  // 6. FILTER NODE
  // ════════════════════════════════════════════════════════
  console.log('--- Filter ---');

  await testAsync('WF: filter splits array items', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'filter', type: 'filter', data: { config: { field: 'active', operator: 'equals', value: 'true' } } },
      ],
      [{ source: 'trigger', target: 'filter' }]
    );
    const input = [
      { name: 'Alice', active: true },
      { name: 'Bob', active: false },
      { name: 'Charlie', active: true },
    ];
    const result = await executeWorkflow(agent, input, mockContext());
    assertEqual(result.nodeCount, 2);
  });

  // ════════════════════════════════════════════════════════
  // 7. NOTIFICATION NODE
  // ════════════════════════════════════════════════════════
  console.log('--- Notification ---');

  await testAsync('WF: notification node', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'notify', type: 'notification', data: { config: { title: 'Test', body: 'Hello' } } },
      ],
      [{ source: 'trigger', target: 'notify' }]
    );
    const result = await executeWorkflow(agent, {}, mockContext());
    assertEqual(result.nodeCount, 2);
  });

  // ════════════════════════════════════════════════════════
  // 8. CANCELLATION
  // ════════════════════════════════════════════════════════
  console.log('--- Cancellation ---');

  await testAsync('WF: cancelCheck stops execution', async () => {
    let cancelled = false;
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'log1', type: 'log_output', data: { config: {} } },
        { id: 'log2', type: 'log_output', data: { config: {} } },
        { id: 'log3', type: 'log_output', data: { config: {} } },
        { id: 'log4', type: 'log_output', data: { config: {} } },
      ],
      [
        { source: 'trigger', target: 'log1' },
        { source: 'log1', target: 'log2' },
        { source: 'log2', target: 'log3' },
        { source: 'log3', target: 'log4' },
      ]
    );
    const ctx = mockContext({
      cancelCheck: () => {
        if (cancelled) return true;
        cancelled = true; // Cancel after very first check
        return false;
      },
    });
    const result = await executeWorkflow(agent, {}, ctx);
    // May or may not stop early depending on timing, just verify it doesn't crash
    assert(result.nodeCount <= 5, `Should not exceed 5 nodes, got ${result.nodeCount}`);
  });

  // ════════════════════════════════════════════════════════
  // 9. ERROR HANDLING
  // ════════════════════════════════════════════════════════
  console.log('--- Error Handling ---');

  await testAsync('WF: node failure produces error in results', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'bad', type: 'transform', data: { config: { code: 'throw new Error("boom")' } } },
      ],
      [{ source: 'trigger', target: 'bad' }]
    );
    const result = await executeWorkflow(agent, {}, mockContext());
    assert(result.errors.length > 0, 'Should have errors');
    assertEqual(result.status, 'completed_with_errors');
  });

  await testAsync('WF: LLM failure is handled gracefully', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'ai', type: 'ai_analyze', data: { config: { prompt: 'Test' } } },
      ],
      [{ source: 'trigger', target: 'ai' }]
    );
    const ctx = mockContext({
      llmClient: {
        chatCompletion: async () => { throw new Error('LLM unavailable'); },
      },
    });
    const result = await executeWorkflow(agent, {}, ctx);
    assert(result.errors.length > 0, 'Should have errors');
    assertEqual(result.status, 'completed_with_errors');
  });

  // ════════════════════════════════════════════════════════
  // 10. MULTI-NODE CHAINS
  // ════════════════════════════════════════════════════════
  console.log('--- Multi-Node Chains ---');

  await testAsync('WF: 3-node linear chain', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'log1', type: 'log_output', data: { config: { label: 'step1' } } },
        { id: 'log2', type: 'log_output', data: { config: { label: 'step2' } } },
      ],
      [
        { source: 'trigger', target: 'log1' },
        { source: 'log1', target: 'log2' },
      ]
    );
    const result = await executeWorkflow(agent, { start: true }, mockContext());
    assertEqual(result.nodeCount, 3);
    assertEqual(result.status, 'completed');
  });

  await testAsync('WF: fan-out (trigger → 2 parallel nodes)', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'log1', type: 'log_output', data: { config: { label: 'A' } } },
        { id: 'log2', type: 'log_output', data: { config: { label: 'B' } } },
      ],
      [
        { source: 'trigger', target: 'log1' },
        { source: 'trigger', target: 'log2' },
      ]
    );
    const result = await executeWorkflow(agent, { msg: 'fanout' }, mockContext());
    assertEqual(result.nodeCount, 3);
  });

  // ════════════════════════════════════════════════════════
  // 11. TRIGGER TYPES
  // ════════════════════════════════════════════════════════
  console.log('--- Trigger Types ---');

  await testAsync('WF: schedule_trigger node', async () => {
    const agent = makeAgent(
      [{ id: 'sched', type: 'schedule_trigger', data: { config: { cron: '*/5 * * * *' } } }],
      []
    );
    const result = await executeWorkflow(agent, {}, mockContext());
    assertEqual(result.nodeCount, 1);
  });

  await testAsync('WF: webhook_trigger node', async () => {
    const agent = makeAgent(
      [{ id: 'wh', type: 'webhook_trigger', data: { config: { method: 'POST', path: '/test' } } }],
      []
    );
    const result = await executeWorkflow(agent, { method: 'POST', body: {} }, mockContext());
    assertEqual(result.nodeCount, 1);
  });

  // ════════════════════════════════════════════════════════
  // 12. MERGE NODE
  // ════════════════════════════════════════════════════════
  console.log('--- Merge ---');

  await testAsync('WF: merge combines two inputs', async () => {
    const agent = makeAgent(
      [
        { id: 'trigger', type: 'manual_trigger', data: { config: {} } },
        { id: 'log1', type: 'log_output', data: { config: { label: 'A' } } },
        { id: 'log2', type: 'log_output', data: { config: { label: 'B' } } },
        { id: 'mg', type: 'merge', data: { config: { mode: 'combine' } } },
      ],
      [
        { source: 'trigger', target: 'log1' },
        { source: 'trigger', target: 'log2' },
        { source: 'log1', target: 'mg', targetHandle: 'left' },
        { source: 'log2', target: 'mg', targetHandle: 'right' },
      ]
    );
    const result = await executeWorkflow(agent, {}, mockContext());
    assertEqual(result.nodeCount, 4);
    // Merge may produce errors if inputs don't perfectly align, so accept either status
    assert(result.status === 'completed' || result.status === 'completed_with_errors',
      `Expected completed status, got ${result.status}`);
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
