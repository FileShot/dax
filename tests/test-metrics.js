// ─── Metrics Module Tests ────────────────────────────────────
'use strict';

const assert = require('assert');
const metrics = require('../src/main/engine/metrics');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
    passed++;
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    failed++;
  }
}

// Reset before each group
metrics.reset();

// ─── Counters ───────────────────────────────────────────────

test('Counter: starts at 0', () => {
  assert.strictEqual(metrics.getCounter('test_counter'), 0);
});

test('Counter: increment by 1', () => {
  metrics.increment('test_counter');
  assert.strictEqual(metrics.getCounter('test_counter'), 1);
});

test('Counter: increment by custom value', () => {
  metrics.increment('test_counter', 10);
  assert.strictEqual(metrics.getCounter('test_counter'), 11);
});

test('Counter: multiple counters are independent', () => {
  metrics.increment('counter_a');
  metrics.increment('counter_b', 5);
  assert.strictEqual(metrics.getCounter('counter_a'), 1);
  assert.strictEqual(metrics.getCounter('counter_b'), 5);
});

// ─── Gauges ─────────────────────────────────────────────────

test('Gauge: undefined before set', () => {
  assert.strictEqual(metrics.getGauge('unset_gauge'), undefined);
});

test('Gauge: set and get', () => {
  metrics.gauge('memory', 1024);
  assert.strictEqual(metrics.getGauge('memory'), 1024);
});

test('Gauge: overwrite', () => {
  metrics.gauge('memory', 2048);
  assert.strictEqual(metrics.getGauge('memory'), 2048);
});

// ─── Histograms ─────────────────────────────────────────────

test('Histogram: null before observe', () => {
  assert.strictEqual(metrics.getHistogram('unset_hist'), null);
});

test('Histogram: single observation', () => {
  metrics.observe('latency', 100);
  const h = metrics.getHistogram('latency');
  assert.strictEqual(h.count, 1);
  assert.strictEqual(h.sum, 100);
  assert.strictEqual(h.min, 100);
  assert.strictEqual(h.max, 100);
  assert.strictEqual(h.avg, 100);
});

test('Histogram: multiple observations', () => {
  metrics.observe('latency', 200);
  metrics.observe('latency', 50);
  const h = metrics.getHistogram('latency');
  assert.strictEqual(h.count, 3);
  assert.strictEqual(h.sum, 350);
  assert.strictEqual(h.min, 50);
  assert.strictEqual(h.max, 200);
  assert.strictEqual(h.avg, Math.round(350 / 3));
});

// ─── getAll ─────────────────────────────────────────────────

test('getAll: returns snapshot with all types', () => {
  const snap = metrics.getAll();
  assert(snap.counters, 'Should have counters');
  assert(snap.gauges, 'Should have gauges');
  assert(snap.histograms, 'Should have histograms');
  assert(typeof snap.uptimeMs === 'number', 'Should have uptimeMs');
});

test('getAll: counters include tracked values', () => {
  const snap = metrics.getAll();
  assert(snap.counters.test_counter >= 11, 'Should include test_counter');
});

test('getAll: gauges include tracked values', () => {
  const snap = metrics.getAll();
  assert.strictEqual(snap.gauges.memory, 2048);
});

test('getAll: histograms include tracked values', () => {
  const snap = metrics.getAll();
  assert(snap.histograms.latency, 'Should include latency histogram');
  assert.strictEqual(snap.histograms.latency.count, 3);
});

// ─── Reset ──────────────────────────────────────────────────

test('Reset: clears all data', () => {
  metrics.reset();
  assert.strictEqual(metrics.getCounter('test_counter'), 0);
  assert.strictEqual(metrics.getGauge('memory'), undefined);
  assert.strictEqual(metrics.getHistogram('latency'), null);
  const snap = metrics.getAll();
  assert.deepStrictEqual(snap.counters, {});
  assert.deepStrictEqual(snap.gauges, {});
  assert.deepStrictEqual(snap.histograms, {});
});

// ─── Results ────────────────────────────────────────────────

console.log('');
console.log('========================================');
console.log('  DAX METRICS MODULE TESTS');
console.log('========================================');
console.log('');

for (const r of results) {
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? ': ' + r.error : ''}`);
}

console.log('');
console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
console.log('========================================');

process.exit(failed > 0 ? 1 : 0);
