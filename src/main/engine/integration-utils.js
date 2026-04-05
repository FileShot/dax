/**
 * Shared integration utilities: token caching, HTTP retry with backoff,
 * per-integration rate limiting, and error normalization.
'use strict';
const https = require('https');

/**
 * In-memory OAuth2 token cache keyed by a string (e.g. clientId).
 * Tokens are evicted 30 seconds before their reported expiry.
 */
class TokenCache {
  constructor() { this._store = new Map(); }

  /** @param {string} key @param {string} token @param {number} expiresInSeconds */
  set(key, token, expiresInSeconds) {
    const expiresAt = Date.now() + Math.max((expiresInSeconds - 30) * 1000, 0);
    this._store.set(key, { token, expiresAt });
  }

  /** @param {string} key @returns {string|null} */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) { this._store.delete(key); return null; }
    return entry.token;
  }

  /** Invalidate one or all entries. @param {string} [key] */
  invalidate(key) {
    if (key) this._store.delete(key);
    else this._store.clear();
  }
}

/**
 * Execute an HTTPS request and return parsed JSON.
 * Retries on network errors or configured status codes with exponential backoff.
 *
 * @param {object} opts         - node https.request options
 * @param {string|null} body    - request body string (or null)
 * @param {object} [retryOpts]
 * @param {number} [retryOpts.retries=3]
 * @param {number[]} [retryOpts.retryOn=[429,500,502,503,504]]
 * @returns {Promise<any>}
 */
function makeRequest(opts, body, { retries = 3, retryOn = [429, 500, 502, 503, 504], timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (remaining > 0 && retryOn.includes(res.statusCode)) {
            const retryAfter = res.headers['retry-after'];
            const delay = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : Math.min(500 * 2 ** (retries - remaining), 8000);
            return setTimeout(() => attempt(remaining - 1), delay);
          }
          try { resolve(JSON.parse(data)); }
          catch { resolve({ raw: data, status: res.statusCode }); }
        });
      });
      req.on('error', (err) => {
        if (remaining > 0) setTimeout(() => attempt(remaining - 1), 1000);
        else reject(err);
      });
      if (timeout > 0) {
        req.setTimeout(timeout, () => {
          req.destroy();
          if (remaining > 0) setTimeout(() => attempt(remaining - 1), 1000);
          else reject(new Error('Request timed out after ' + timeout + 'ms'));
        });
      }
      if (body) req.write(body);
      req.end();
    };
    attempt(retries);
  });
}

/**
 * Simple token-bucket rate limiter keyed by an arbitrary string.
 * Prevents integration actions from hammering a downstream API.
 */
class RateLimiter {
  constructor() { this._buckets = new Map(); }

  /**
   * Wait if the key has exhausted its quota, then consume one token.
   * @param {string} key - e.g. integration id
   * @param {number} maxRequests - tokens per window
   * @param {number} windowMs - window size in milliseconds
   */
  async throttle(key, maxRequests = 20, windowMs = 1000) {
    const now = Date.now();
    let bucket = this._buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { tokens: maxRequests, resetAt: now + windowMs };
      this._buckets.set(key, bucket);
    }
    if (bucket.tokens <= 0) {
      const wait = bucket.resetAt - now;
      await new Promise((r) => setTimeout(r, wait));
      bucket.tokens = maxRequests;
      bucket.resetAt = Date.now() + windowMs;
    }
    bucket.tokens--;
  }
}

/**
 * Normalize any thrown error into a consistent shape for callers.
 * @param {Error|any} err
 * @param {{ integration?: string, action?: string }} [ctx]
 * @returns {{ error: true, message: string, status: number|null, code: string|null, retryable: boolean, integration: string, action: string }}
 */
function normalizeError(err, { integration = 'unknown', action = 'unknown' } = {}) {
  const status = err.status || err.statusCode || null;
  const code = err.code || null;
  const retryable = [429, 500, 502, 503, 504].includes(status) ||
    code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
  return {
    error: true,
    integration,
    action,
    message: err.message || String(err),
    status,
    code,
    retryable,
  };
}

// ─── Circuit Breaker ─────────────────────────────────────────────────────────
const CB = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

/**
 * Per-key circuit breaker. Opens after failureThreshold consecutive failures,
 * waits resetTimeoutMs, then allows one probe (HALF_OPEN). Closes after
 * successThreshold consecutive successes in HALF_OPEN state.
 */
class CircuitBreaker {
  constructor({ failureThreshold = 5, resetTimeoutMs = 60000, successThreshold = 2 } = {}) {
    this._opts = { failureThreshold, resetTimeoutMs, successThreshold };
    this._circuits = new Map();
  }

  _get(key) {
    if (!this._circuits.has(key)) {
      this._circuits.set(key, { state: CB.CLOSED, failures: 0, successes: 0, openedAt: null });
    }
    return this._circuits.get(key);
  }

  getState(key) {
    const c = this._get(key);
    if (c.state === CB.OPEN && c.openedAt && Date.now() - c.openedAt >= this._opts.resetTimeoutMs) {
      c.state = CB.HALF_OPEN;
      c.successes = 0;
    }
    return c.state;
  }

  isAllowed(key) { return this.getState(key) !== CB.OPEN; }

  onSuccess(key) {
    const c = this._get(key);
    if (c.state === CB.HALF_OPEN) {
      if (++c.successes >= this._opts.successThreshold) {
        c.state = CB.CLOSED; c.failures = 0; c.successes = 0; c.openedAt = null;
      }
    } else { c.failures = 0; }
  }

  onFailure(key) {
    const c = this._get(key);
    if (c.state === CB.HALF_OPEN) {
      c.state = CB.OPEN; c.openedAt = Date.now(); return;
    }
    if (c.state === CB.CLOSED && ++c.failures >= this._opts.failureThreshold) {
      c.state = CB.OPEN; c.openedAt = Date.now();
    }
  }

  allStatuses() {
    const out = {};
    for (const [key] of this._circuits) {
      const c = this._circuits.get(key);
      out[key] = { state: this.getState(key), failures: c.failures, openedAt: c.openedAt };
    }
    return out;
  }
}

// ─── Error Budget ─────────────────────────────────────────────────────────────
/**
 * Sliding-window error budget per key.
 * Records successes/failures and reports whether the error limit is exhausted.
 */
class ErrorBudget {
  constructor({ windowMs = 5 * 60 * 1000, errorLimit = 10 } = {}) {
    this._opts = { windowMs, errorLimit };
    this._events = new Map(); // key → [{ time, isError }]
  }

  _prune(key) {
    const cutoff = Date.now() - this._opts.windowMs;
    const evts = (this._events.get(key) || []).filter((e) => e.time > cutoff);
    this._events.set(key, evts);
    return evts;
  }

  record(key, isError) {
    const evts = this._prune(key);
    evts.push({ time: Date.now(), isError });
  }

  status(key) {
    const evts = this._prune(key);
    const errors = evts.filter((e) => e.isError).length;
    const budget = Math.max(0, this._opts.errorLimit - errors);
    return { total: evts.length, errors, budget, exhausted: budget === 0 };
  }

  allStatuses() {
    const out = {};
    for (const [key] of this._events) out[key] = this.status(key);
    return out;
  }
}

module.exports = { TokenCache, makeRequest, RateLimiter, normalizeError, CircuitBreaker, ErrorBudget };
