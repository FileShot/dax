// ─── Metrics Collector ────────────────────────────────────────
// Lightweight in-memory metrics for monitoring Dax service health.
// No external dependencies. Tracks counters, gauges, and histograms.

'use strict';

const _counters = new Map();
const _gauges = new Map();
const _histograms = new Map();
const _startTime = Date.now();

// ─── Counters (monotonically increasing) ─────────────────────

function increment(name, value = 1) {
  _counters.set(name, (_counters.get(name) || 0) + value);
}

function getCounter(name) {
  return _counters.get(name) || 0;
}

// ─── Gauges (point-in-time values) ───────────────────────────

function gauge(name, value) {
  _gauges.set(name, value);
}

function getGauge(name) {
  return _gauges.get(name);
}

// ─── Histograms (track distributions via min/max/avg/count) ──

function observe(name, value) {
  let h = _histograms.get(name);
  if (!h) {
    h = { count: 0, sum: 0, min: Infinity, max: -Infinity };
    _histograms.set(name, h);
  }
  h.count++;
  h.sum += value;
  if (value < h.min) h.min = value;
  if (value > h.max) h.max = value;
}

function getHistogram(name) {
  const h = _histograms.get(name);
  if (!h) return null;
  return {
    count: h.count,
    sum: h.sum,
    min: h.min === Infinity ? 0 : h.min,
    max: h.max === -Infinity ? 0 : h.max,
    avg: h.count > 0 ? Math.round(h.sum / h.count) : 0,
  };
}

// ─── Snapshot ────────────────────────────────────────────────

function getAll() {
  const counters = {};
  for (const [k, v] of _counters) counters[k] = v;

  const gauges = {};
  for (const [k, v] of _gauges) gauges[k] = v;

  const histograms = {};
  for (const [k] of _histograms) histograms[k] = getHistogram(k);

  return { counters, gauges, histograms, uptimeMs: Date.now() - _startTime };
}

function reset() {
  _counters.clear();
  _gauges.clear();
  _histograms.clear();
}

module.exports = { increment, getCounter, gauge, getGauge, observe, getHistogram, getAll, reset };
