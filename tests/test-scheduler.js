// ─── Scheduler Tests ────────────────────────────────────────
// Tests cron scheduling, unscheduling, status, and edge cases.
// Uses mock agent-runner to avoid real LLM calls.

'use strict';
const cron = require('node-cron');

let passed = 0;
let failed = 0;
const results = [];
const logMessages = [];

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
  if (actual !== expected) throw new Error(msg || `Expected ${expected}, got ${actual}`);
}

// ─── Mock agent-runner ──────────────────────────────────────
// Write mock before loading scheduler so it picks up the mock
const fs = require('fs');
const path = require('path');

const realRunnerPath = path.join(__dirname, '..', 'src', 'main', 'engine', 'agent-runner.js');
const backupPath = realRunnerPath + '.bak';

// Back up real runner
fs.copyFileSync(realRunnerPath, backupPath);

// Write mock runner
fs.writeFileSync(realRunnerPath, `
  'use strict';
  const EventEmitter = require('events');
  const events = new EventEmitter();
  module.exports = {
    executeAgent: async (agent, triggerData) => {
      return { id: 'test-run-id', status: 'completed' };
    },
    cancelRun: () => {},
    getActiveRuns: () => [],
    events,
    toolRegistry: { registerTool: () => {}, list: () => [] },
  };
`);

// Now require the real scheduler (which will load the mock runner)
const scheduler = require('../src/main/engine/scheduler');

// Mock db helpers
const mockAgents = [];
const mockLog = (level, cat, msg, data) => { logMessages.push({ level, cat, msg, data }); };

scheduler.init({
  dbAll: () => mockAgents,
  dbGet: () => null,
  dbRun: () => {},
  getDb: async () => ({}),
  log: mockLog,
});

try {
  console.log('');
  console.log('========================================');
  console.log('  DAX SCHEDULER TESTS');
  console.log('========================================');
  console.log('');

  // ─── Schedule / Unschedule ───────────────────────────────
  console.log('--- Schedule / Unschedule ---');

  test('Scheduler: scheduleAgent creates cron job', () => {
    scheduler.scheduleAgent({
      id: 'agent-1',
      name: 'Test Agent',
      trigger_type: 'schedule',
      trigger_config: { cron: '*/5 * * * *' },
    });
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 1, `Expected 1 cron job, got ${status.cronJobs}`);
    assert(status.agents.find(a => a.id === 'agent-1'), 'agent-1 should be in agents list');
  });

  test('Scheduler: scheduleAgent replaces existing', () => {
    scheduler.scheduleAgent({
      id: 'agent-1',
      name: 'Test Agent Updated',
      trigger_type: 'schedule',
      trigger_config: { cron: '*/10 * * * *' },
    });
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 1, 'Still 1 job after replacement');
  });

  test('Scheduler: unscheduleAgent removes job', () => {
    scheduler.unscheduleAgent('agent-1');
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 0, 'Should have 0 cron jobs');
  });

  test('Scheduler: unschedule nonexistent is safe', () => {
    scheduler.unscheduleAgent('nonexistent-agent'); // Should not throw
  });

  // ─── Invalid Cron ──────────────────────────────────────
  console.log('--- Invalid Cron ---');

  test('Scheduler: rejects invalid cron expression', () => {
    logMessages.length = 0;
    scheduler.scheduleAgent({
      id: 'bad-cron',
      name: 'Bad Cron',
      trigger_type: 'schedule',
      trigger_config: { cron: 'not-a-cron' },
    });
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 0, 'Invalid cron should not create a job');
    const errorLog = logMessages.find(l => l.level === 'error' && l.msg.includes('Invalid cron'));
    assert(errorLog, 'Should log an error for invalid cron');
  });

  test('Scheduler: warns when no cron schedule set', () => {
    logMessages.length = 0;
    scheduler.scheduleAgent({
      id: 'no-cron',
      name: 'No Cron',
      trigger_type: 'schedule',
      trigger_config: {},
    });
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 0);
    const warnLog = logMessages.find(l => l.level === 'warn');
    assert(warnLog, 'Should log a warning when no cron schedule');
  });

  // ─── String trigger_config ─────────────────────────────
  console.log('--- trigger_config Parsing ---');

  test('Scheduler: handles JSON string trigger_config', () => {
    scheduler.scheduleAgent({
      id: 'json-string',
      name: 'JSON String Config',
      trigger_type: 'schedule',
      trigger_config: '{"cron":"*/2 * * * *"}',
    });
    const status = scheduler.getStatus();
    assert(status.agents.find(a => a.id === 'json-string'), 'Should accept JSON string config');
    scheduler.unscheduleAgent('json-string');
  });

  test('Scheduler: handles trigger_config with schedule key', () => {
    scheduler.scheduleAgent({
      id: 'alt-key',
      name: 'Alt Key Config',
      trigger_type: 'schedule',
      trigger_config: { schedule: '*/3 * * * *' },
    });
    const status = scheduler.getStatus();
    assert(status.agents.find(a => a.id === 'alt-key'), 'Should accept schedule key');
    scheduler.unscheduleAgent('alt-key');
  });

  // ─── Multiple Agents ──────────────────────────────────
  console.log('--- Multiple Agents ---');

  test('Scheduler: handles multiple concurrent schedules', () => {
    scheduler.scheduleAgent({ id: 'a1', name: 'A1', trigger_type: 'schedule', trigger_config: { cron: '*/1 * * * *' } });
    scheduler.scheduleAgent({ id: 'a2', name: 'A2', trigger_type: 'schedule', trigger_config: { cron: '*/2 * * * *' } });
    scheduler.scheduleAgent({ id: 'a3', name: 'A3', trigger_type: 'schedule', trigger_config: { cron: '*/3 * * * *' } });
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 3, `Expected 3 cron jobs, got ${status.cronJobs}`);
    assertEqual(status.scheduled, 3, `Expected 3 scheduled, got ${status.scheduled}`);
  });

  // ─── stopAll ──────────────────────────────────────────
  console.log('--- stopAll ---');

  test('Scheduler: stopAll clears everything', () => {
    scheduler.stopAll();
    const status = scheduler.getStatus();
    assertEqual(status.cronJobs, 0, 'cronJobs should be 0');
    assertEqual(status.fileWatchers, 0, 'fileWatchers should be 0');
    assertEqual(status.scheduled, 0, 'scheduled should be 0');
    assertEqual(status.running, 0, 'running should be 0');
    assertEqual(status.agents.length, 0, 'agents list should be empty');
  });

  // ─── getStatus Shape ─────────────────────────────────
  console.log('--- Status Shape ---');

  test('Scheduler: getStatus returns expected shape', () => {
    const status = scheduler.getStatus();
    assert('scheduled' in status, 'Should have scheduled field');
    assert('running' in status, 'Should have running field');
    assert('cronJobs' in status, 'Should have cronJobs field');
    assert('fileWatchers' in status, 'Should have fileWatchers field');
    assert(Array.isArray(status.agents), 'agents should be an array');
  });

  // ─── Results ──────────────────────────────────────────
  console.log('');
  console.log('========================================');
  console.log('  RESULTS');
  console.log('========================================');
  console.log('');
  results.forEach(r => console.log(r));
  console.log(`\n  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================');

  if (failed > 0) process.exit(1);

} catch (err) {
  console.error('Test runner crashed:', err);
  process.exit(1);
} finally {
  // Restore real runner
  try { fs.copyFileSync(backupPath, realRunnerPath); fs.unlinkSync(backupPath); } catch (_) {}
  // Stop any remaining cron jobs
  scheduler.stopAll();
}
