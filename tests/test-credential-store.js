// ─── Credential Store Tests ─────────────────────────────────
// Tests AES-256-GCM encryption, storage, retrieval, deletion, and cache behavior.
// Does NOT test Electron safeStorage (requires running Electron process).

'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { CredentialStore } = require('../src/main/credential-store');

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

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${expected}, got ${actual}`);
}

// Create a temp directory for each test run
const testDir = path.join(os.tmpdir(), `dax-cred-test-${Date.now()}`);

try {
  console.log('');
  console.log('========================================');
  console.log('  DAX CREDENTIAL STORE TESTS');
  console.log('========================================');
  console.log('');

  // ─── Basic Operations ───────────────────────────────────
  console.log('--- Basic Operations ---');

  const store = new CredentialStore(testDir);

  test('Store: directory created', () => {
    assert(fs.existsSync(testDir), 'Storage directory should exist');
  });

  test('Store: set creates encrypted file', () => {
    store.set('test-integration', {
      credentials: { api_key: 'sk-test-12345', secret: 'my-secret' },
      providerId: null,
    });
    const encFile = path.join(testDir, 'test-integration.enc');
    assert(fs.existsSync(encFile), 'Encrypted file should exist');
    const content = fs.readFileSync(encFile, 'utf-8');
    assert(!content.includes('sk-test-12345'), 'File content should be encrypted (not plaintext)');
    assert(!content.includes('my-secret'), 'Secret should not appear in plaintext');
  });

  test('Store: get retrieves credentials', () => {
    const record = store.get('test-integration');
    assert(record, 'Record should exist');
    assertEqual(record.integrationId, 'test-integration');
    assertEqual(record.credentials.api_key, 'sk-test-12345');
    assertEqual(record.credentials.secret, 'my-secret');
    assert(record.connectedAt, 'Should have connectedAt timestamp');
  });

  test('Store: get returns null for unknown', () => {
    const record = store.get('nonexistent');
    assertEqual(record, null, 'Should return null for unknown integration');
  });

  test('Store: list returns stored integrations', () => {
    const list = store.list();
    assert(list.length >= 1, 'Should have at least 1 integration');
    const entry = list.find(e => e.integrationId === 'test-integration');
    assert(entry, 'Should include test-integration');
    assert(entry.connectedAt, 'Should have connectedAt');
  });

  test('Store: set with providerId', () => {
    store.set('oauth-integration', {
      credentials: { access_token: 'tok_abc' },
      providerId: 'google',
      oauthMeta: {
        clientId: 'client-123',
        clientSecret: 'secret-456',
        refreshToken: 'refresh-789',
        expiresAt: Date.now() + 3600000,
        redirectUri: 'http://localhost/callback',
      },
    });
    const record = store.get('oauth-integration');
    assertEqual(record.providerId, 'google');
    assert(record.oauthMeta, 'Should have oauthMeta');
    assertEqual(record.oauthMeta.clientId, 'client-123');
    assertEqual(record.oauthMeta.refreshToken, 'refresh-789');
  });

  test('Store: update overwrites existing', () => {
    store.set('test-integration', {
      credentials: { api_key: 'sk-updated-key' },
    });
    const record = store.get('test-integration');
    assertEqual(record.credentials.api_key, 'sk-updated-key');
  });

  test('Store: delete removes credential', () => {
    store.delete('test-integration');
    const record = store.get('test-integration');
    assertEqual(record, null, 'Should be null after delete');
    const encFile = path.join(testDir, 'test-integration.enc');
    assert(!fs.existsSync(encFile), 'Encrypted file should be removed');
  });

  test('Store: delete nonexistent is safe', () => {
    store.delete('does-not-exist'); // Should not throw
  });

  // ─── Persistence ────────────────────────────────────────
  console.log('--- Persistence ---');

  test('Store: new instance loads from disk', () => {
    // oauth-integration should still be on disk
    const store2 = new CredentialStore(testDir);
    const record = store2.get('oauth-integration');
    assert(record, 'Should load from disk');
    assertEqual(record.credentials.access_token, 'tok_abc');
    assertEqual(record.providerId, 'google');
  });

  test('Store: fallback key is generated', () => {
    const keyFile = path.join(testDir, '.store-key');
    assert(fs.existsSync(keyFile), '.store-key file should exist');
    const keyHex = fs.readFileSync(keyFile, 'utf-8').trim();
    assertEqual(keyHex.length, 64, 'Key should be 32 bytes (64 hex chars)');
  });

  // ─── Validation ─────────────────────────────────────────
  console.log('--- Validation ---');

  test('Store: set requires integrationId', () => {
    try {
      store.set('', { credentials: {} });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('integrationId required'), `Unexpected error: ${err.message}`);
    }
  });

  test('Store: set with null integrationId throws', () => {
    try {
      store.set(null, { credentials: {} });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('integrationId required'), `Unexpected error: ${err.message}`);
    }
  });

  // ─── Multiple Credentials ──────────────────────────────
  console.log('--- Multiple Credentials ---');

  test('Store: handles multiple integrations', () => {
    store.set('slack', { credentials: { bot_token: 'xoxb-123' } });
    store.set('discord', { credentials: { bot_token: 'MTk4-456' } });
    store.set('github', { credentials: { token: 'ghp_789' } });
    const list = store.list();
    assert(list.length >= 4, `Should have at least 4 integrations, got ${list.length}`);
    assert(list.find(e => e.integrationId === 'slack'), 'Should include slack');
    assert(list.find(e => e.integrationId === 'discord'), 'Should include discord');
    assert(list.find(e => e.integrationId === 'github'), 'Should include github');
  });

  // ─── Corrupted Data ────────────────────────────────────
  console.log('--- Corrupted Data ---');

  test('Store: handles corrupted .enc file gracefully', () => {
    fs.writeFileSync(path.join(testDir, 'corrupted.enc'), 'not-valid-base64!!!', 'utf-8');
    const store3 = new CredentialStore(testDir);
    const record = store3.get('corrupted');
    assertEqual(record, null, 'Should return null for corrupted file');
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
  // Cleanup
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (_) {}
}
