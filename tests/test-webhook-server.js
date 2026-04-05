// ─── Webhook Server Tests ───────────────────────────────────
// Tests the webhook HTTP server in agent-service.js.
// Makes real HTTP requests to localhost:3700.
// Requires: Electron app running (agent-service.js with webhook server)

const http = require('http');

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

// ─── HTTP request helper ────────────────────────────────────

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3700,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('\n========================================');
  console.log('  DAX WEBHOOK SERVER TESTS');
  console.log('========================================\n');

  // Check if server is running first
  console.log('--- Server Connectivity ---');

  let serverRunning = false;
  await testAsync('Webhook: server is reachable on port 3700', async () => {
    const res = await httpRequest('GET', '/health');
    assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'ok' || res.data.status === 'running', `Expected ok status, got ${res.data.status}`);
    serverRunning = true;
  });

  if (!serverRunning) {
    console.log('\n  WARNING: Webhook server not running on port 3700');
    console.log('  Start the Electron app first to run these tests\n');
    console.log('========================================');
    console.log('  RESULTS');
    console.log('========================================\n');
    for (const r of results) console.log(r);
    console.log(`\n  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('========================================\n');
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  // ════════════════════════════════════════════════════════
  // 1. HEALTH ENDPOINT
  // ════════════════════════════════════════════════════════
  console.log('--- Health Endpoint ---');

  await testAsync('Webhook: /health returns status and uptime', async () => {
    const res = await httpRequest('GET', '/health');
    assertEqual(res.status, 200);
    assert(res.data.uptime >= 0, 'Should have uptime');
    assert(res.data.pid > 0, 'Should have pid');
  });

  await testAsync('Webhook: /health has JSON content-type', async () => {
    const res = await httpRequest('GET', '/health');
    assert(res.headers['content-type'].includes('application/json'), 'Should be JSON');
  });

  // ════════════════════════════════════════════════════════
  // 2. CORS
  // ════════════════════════════════════════════════════════
  console.log('--- CORS ---');

  await testAsync('Webhook: OPTIONS returns CORS headers', async () => {
    const res = await httpRequest('OPTIONS', '/webhook/test/token');
    assertEqual(res.status, 204);
    assert(res.headers['access-control-allow-origin'] === '*', 'Should allow all origins');
    assert(res.headers['access-control-allow-methods'], 'Should have allowed methods');
  });

  // ════════════════════════════════════════════════════════
  // 3. INVALID REQUESTS
  // ════════════════════════════════════════════════════════
  console.log('--- Invalid Requests ---');

  await testAsync('Webhook: GET /webhook returns 404', async () => {
    const res = await httpRequest('GET', '/webhook');
    assert(res.status === 404 || res.status === 405, `Expected 404/405, got ${res.status}`);
  });

  await testAsync('Webhook: POST to nonexistent agent returns 403/404', async () => {
    const res = await httpRequest('POST', '/webhook/nonexistent-agent-id/fake-token', { test: true });
    assert(res.status === 403 || res.status === 404, `Expected 403/404, got ${res.status}`);
  });

  await testAsync('Webhook: POST with wrong token returns 403', async () => {
    const res = await httpRequest('POST', '/webhook/any-agent/wrong-token', { test: true });
    assert(res.status === 403 || res.status === 404, `Expected 403/404, got ${res.status}`);
  });

  await testAsync('Webhook: unknown path returns 404', async () => {
    const res = await httpRequest('GET', '/unknown/path');
    assertEqual(res.status, 404);
  });

  // ════════════════════════════════════════════════════════
  // 4. REQUEST FORMAT
  // ════════════════════════════════════════════════════════
  console.log('--- Request Format ---');

  await testAsync('Webhook: empty body handled gracefully', async () => {
    const res = await httpRequest('POST', '/webhook/test-agent/fake-token');
    // Should not crash — returns 403/404 for bad agent, not 500
    assert(res.status !== 500, `Should not return 500, got ${res.status}`);
  });

  await testAsync('Webhook: invalid JSON body handled gracefully', async () => {
    const res = await httpRequest('POST', '/webhook/test-agent/fake-token', 'not json', {
      'Content-Type': 'text/plain',
    });
    assert(res.status !== 500, `Should not return 500, got ${res.status}`);
  });

  // ════════════════════════════════════════════════════════
  // 5. RESPONSE FORMAT
  // ════════════════════════════════════════════════════════
  console.log('--- Response Format ---');

  await testAsync('Webhook: error responses have JSON body', async () => {
    const res = await httpRequest('POST', '/webhook/nonexistent/token', {});
    assert(typeof res.data === 'object', 'Error response should be JSON object');
    assert(res.data.error, 'Error response should have error field');
  });

  await testAsync('Webhook: health response has correct structure', async () => {
    const res = await httpRequest('GET', '/health');
    const keys = Object.keys(res.data);
    assert(keys.includes('status'), 'Should have status');
    assert(keys.includes('uptime'), 'Should have uptime');
    assert(keys.includes('pid'), 'Should have pid');
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
