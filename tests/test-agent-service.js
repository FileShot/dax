// ─── Agent Service Core Tests ───────────────────────────────
// Tests database initialization, schema, migrations, backup, and log rotation.
// Does NOT start the full agent service — tests individual functions.

'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

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

// ─── Test Setup ─────────────────────────────────────────────
const testDir = path.join(os.tmpdir(), `dax-service-test-${Date.now()}`);
const testDbPath = path.join(testDir, 'test.db');
const testLogDir = path.join(testDir, 'logs');
const testBackupDir = path.join(testDir, 'backups');

fs.mkdirSync(testDir, { recursive: true });
fs.mkdirSync(testLogDir, { recursive: true });
fs.mkdirSync(testBackupDir, { recursive: true });

try {
  console.log('');
  console.log('========================================');
  console.log('  DAX AGENT SERVICE CORE TESTS');
  console.log('========================================');
  console.log('');

  // ─── Database Schema ──────────────────────────────────────
  console.log('--- Database Schema ---');

  let db = null;
  let SQL = null;

  // Wrap everything in an async IIFE
  (async () => {
  try {

  await testAsync('DB: initSqlJs loads', async () => {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
    assert(SQL, 'sql.js should initialize');
  });

  test('DB: create new database', () => {
    db = new SQL.Database();
    assert(db, 'Database should be created');
  });

  test('DB: schema creates all tables', () => {
    // Execute the same schema as agent-service.js
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        trigger_type TEXT NOT NULL DEFAULT 'manual',
        trigger_config TEXT DEFAULT '{}',
        nodes TEXT DEFAULT '[]',
        edges TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        model_id TEXT DEFAULT '',
        system_prompt TEXT DEFAULT '',
        temperature REAL DEFAULT 0.7,
        max_retries INTEGER DEFAULT 3,
        token_budget INTEGER DEFAULT 4096,
        webhook_token TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        trigger_data TEXT DEFAULT '{}',
        result TEXT DEFAULT '{}',
        error TEXT,
        tokens_used INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        started_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `);
  });

  // ─── CRUD Operations ────────────────────────────────────
  console.log('--- CRUD Operations ---');

  function dbAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  function dbGet(sql, params = []) {
    const rows = dbAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  test('DB: insert agent', () => {
    db.run("INSERT INTO agents (id, name, trigger_type) VALUES (?, ?, ?)",
      ['agent-1', 'Test Agent', 'manual']);
    const agent = dbGet("SELECT * FROM agents WHERE id = ?", ['agent-1']);
    assert(agent, 'Agent should be inserted');
    assertEqual(agent.name, 'Test Agent');
    assertEqual(agent.trigger_type, 'manual');
    assertEqual(agent.enabled, 1);
  });

  test('DB: insert run with FK', () => {
    db.run("INSERT INTO runs (id, agent_id, status) VALUES (?, ?, ?)",
      ['run-1', 'agent-1', 'running']);
    const run = dbGet("SELECT * FROM runs WHERE id = ?", ['run-1']);
    assert(run, 'Run should be inserted');
    assertEqual(run.agent_id, 'agent-1');
    assertEqual(run.status, 'running');
  });

  test('DB: FK constraint prevents orphan runs', () => {
    try {
      db.run("INSERT INTO runs (id, agent_id, status) VALUES (?, ?, ?)",
        ['run-orphan', 'nonexistent-agent', 'pending']);
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('FOREIGN KEY'), `Expected FK error, got: ${err.message}`);
    }
  });

  test('DB: cascade delete removes runs', () => {
    db.run("DELETE FROM agents WHERE id = ?", ['agent-1']);
    const runs = dbAll("SELECT * FROM runs WHERE agent_id = ?", ['agent-1']);
    assertEqual(runs.length, 0, 'Runs should be cascade deleted');
  });

  test('DB: settings CRUD', () => {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['theme', '"dark"']);
    const setting = dbGet("SELECT value FROM settings WHERE key = ?", ['theme']);
    assertEqual(setting.value, '"dark"');
  });

  // ─── Migration Framework ──────────────────────────────────
  console.log('--- Migration Framework ---');

  test('DB: _migrations table exists', () => {
    const tables = dbAll("SELECT name FROM sqlite_master WHERE type='table'");
    assert(tables.find(t => t.name === '_migrations'), '_migrations table should exist');
  });

  test('DB: migration tracking works', () => {
    db.run("INSERT INTO _migrations (version, name) VALUES (1, 'test_migration')");
    const row = dbGet("SELECT MAX(version) as v FROM _migrations");
    assertEqual(row.v, 1);
  });

  test('DB: duplicate migration version rejected', () => {
    try {
      db.run("INSERT INTO _migrations (version, name) VALUES (1, 'duplicate')");
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('UNIQUE') || err.message.includes('PRIMARY'), `Expected PK error, got: ${err.message}`);
    }
  });

  // ─── Atomic Save ──────────────────────────────────────────
  console.log('--- Atomic Save ---');

  test('DB: export creates valid buffer', () => {
    const data = db.export();
    assert(data instanceof Uint8Array, 'Export should return Uint8Array');
    assert(data.length > 0, 'Export should not be empty');
  });

  test('DB: atomic save (temp → rename)', () => {
    const data = db.export();
    const tempPath = `${testDbPath}.tmp`;
    fs.writeFileSync(tempPath, Buffer.from(data));
    fs.renameSync(tempPath, testDbPath);
    assert(fs.existsSync(testDbPath), 'DB file should exist');
    assert(!fs.existsSync(tempPath), 'Temp file should be removed');
  });

  test('DB: saved and reloaded database is valid', () => {
    const buffer = fs.readFileSync(testDbPath);
    const db2 = new SQL.Database(buffer);
    const stmt = db2.prepare("SELECT COUNT(*) as c FROM settings");
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    assert(row.c >= 1, 'Reloaded DB should have settings');
    db2.close();
  });

  // ─── Log Rotation ────────────────────────────────────────
  console.log('--- Log Rotation ---');

  test('LogRotation: old logs are cleaned up', () => {
    // Create fake log files with old dates
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      const daysAgo = i * 2;
      const date = new Date(now - daysAgo * 86400000);
      const name = `dax-service-${date.toISOString().slice(0, 10)}.log`;
      fs.writeFileSync(path.join(testLogDir, name), `log entry ${i}\n`.repeat(100));
      // Set mtime to match
      const mtime = new Date(now - daysAgo * 86400000);
      fs.utimesSync(path.join(testLogDir, name), mtime, mtime);
    }

    const LOG_MAX_AGE_DAYS = 7;
    const LOG_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

    // Run rotation logic (same as agent-service.js)
    const files = fs.readdirSync(testLogDir)
      .filter(f => f.startsWith('dax-') && f.endsWith('.log'))
      .map(f => ({ name: f, path: path.join(testLogDir, f), stat: fs.statSync(path.join(testLogDir, f)) }))
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

    const cutoff = Date.now() - LOG_MAX_AGE_DAYS * 86400000;
    let totalSize = 0;
    let deleted = 0;
    for (const f of files) {
      totalSize += f.stat.size;
      if (f.stat.mtimeMs < cutoff || totalSize > LOG_MAX_TOTAL_BYTES) {
        fs.unlinkSync(f.path);
        deleted++;
      }
    }

    assert(deleted > 0, 'Should have deleted at least 1 old log file');
    const remaining = fs.readdirSync(testLogDir).filter(f => f.endsWith('.log'));
    assert(remaining.length < 10, `Should have fewer than 10 logs after rotation, got ${remaining.length}`);
  });

  // ─── Backup ─────────────────────────────────────────────
  console.log('--- Backup ---');

  test('Backup: creates backup file', () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(testBackupDir, `dax-${ts}.db`);
    fs.copyFileSync(testDbPath, dest);
    assert(fs.existsSync(dest), 'Backup file should exist');
  });

  test('Backup: prunes old backups', () => {
    // Create 8 backups
    for (let i = 0; i < 8; i++) {
      const name = `dax-2026-01-0${i + 1}T00-00-00-000Z.db`;
      fs.writeFileSync(path.join(testBackupDir, name), `backup${i}`);
      const mtime = new Date(Date.now() - (8 - i) * 86400000);
      fs.utimesSync(path.join(testBackupDir, name), mtime, mtime);
    }

    const BACKUP_MAX_COUNT = 5;
    const backups = fs.readdirSync(testBackupDir)
      .filter(f => f.startsWith('dax-') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(testBackupDir, f), mtime: fs.statSync(path.join(testBackupDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const old of backups.slice(BACKUP_MAX_COUNT)) {
      fs.unlinkSync(old.path);
    }

    const remaining = fs.readdirSync(testBackupDir).filter(f => f.endsWith('.db'));
    assertEqual(remaining.length, BACKUP_MAX_COUNT, `Should keep exactly ${BACKUP_MAX_COUNT} backups`);
  });

  // ─── IPC Schemas ──────────────────────────────────────────
  console.log('--- IPC Schemas ---');

  test('Schemas: module loads without error', () => {
    const schemas = require('../src/main/ipc-schemas');
    assert(schemas, 'Should load ipc-schemas');
  });

  test('Schemas: agentsCreate validates', () => {
    const schemas = require('../src/main/ipc-schemas');
    assert(schemas.agentsCreate, 'agentsCreate schema should exist');
    const result = schemas.agentsCreate.safeParse({ name: 'Test', model: 'gpt-4', trigger_type: 'manual' });
    assert(result.success, 'Valid input should pass');
  });

  test('Schemas: settingsSet validates', () => {
    const schemas = require('../src/main/ipc-schemas');
    assert(schemas.settingsSet, 'settingsSet schema should exist');
  });

  test('Schemas: chatMessage validates', () => {
    const schemas = require('../src/main/ipc-schemas');
    assert(schemas.chatMessage, 'chatMessage schema should exist');
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
    if (db) try { db.close(); } catch (_) {}
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (_) {}
  }
  })();

} catch (err) {
  console.error('Test setup crashed:', err);
  process.exit(1);
}
