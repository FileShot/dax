// ─── Integration Backend Tests ──────────────────────────────
// Tests all 5 integrations: Registry, Slack, Discord, Twilio, Google Sheets, Database
// Database integration is tested end-to-end with real SQLite
// API integrations are tested for structure, error handling, and graceful failures

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
  if (actual !== expected) throw new Error(msg || `Expected ${expected}, got ${actual}`);
}

async function run() {
  console.log('\n========================================');
  console.log('  DAX INTEGRATION TESTS');
  console.log('========================================\n');

  // ─── 1. Registry Tests ──────────────────────────────────
  console.log('--- Registry ---');
  const registry = require('../src/main/engine/integrations/registry');
  
  // Clear any prior state by re-registering
  const slackConfig = require('../src/main/engine/integrations/slack');
  const discordConfig = require('../src/main/engine/integrations/discord');
  const twilioConfig = require('../src/main/engine/integrations/twilio');
  const gsheetsConfig = require('../src/main/engine/integrations/google-sheets');
  const dbConfig = require('../src/main/engine/integrations/database');

  registry.register(slackConfig);
  registry.register(discordConfig);
  registry.register(twilioConfig);
  registry.register(gsheetsConfig);
  registry.register(dbConfig);

  test('Registry: list returns all 5 integrations', () => {
    const all = registry.list();
    assert(all.length >= 5, `Expected at least 5, got ${all.length}`);
    const ids = all.map(i => i.id);
    assert(ids.includes('slack'), 'Missing slack');
    assert(ids.includes('discord'), 'Missing discord');
    assert(ids.includes('twilio'), 'Missing twilio');
    assert(ids.includes('database'), 'Missing database');
  });

  test('Registry: get returns specific integration', () => {
    const slack = registry.get('slack');
    assert(slack !== null && slack !== undefined, 'Slack integration not found');
    assertEqual(slack.name, 'Slack');
    assertEqual(slack.category, 'communication');
  });

  test('Registry: each integration has required fields', () => {
    const all = registry.list();
    for (const integ of all) {
      assert(integ.id, `Missing id on integration: ${JSON.stringify(integ)}`);
      assert(integ.name, `Missing name on ${integ.id}`);
      assert(integ.category, `Missing category on ${integ.id}`);
      assert(integ.icon, `Missing icon on ${integ.id}`);
      assert(Array.isArray(integ.actions), `Missing actions array on ${integ.id}`);
      assert(integ.actions.length > 0, `No actions defined on ${integ.id}`);
    }
  });

  test('Registry: integrations start disconnected', () => {
    const all = registry.list();
    for (const integ of all) {
      assertEqual(integ.connected, false, `${integ.id} should start disconnected`);
    }
  });

  test('Registry: listByCategory works', () => {
    const comms = registry.listByCategory('communication');
    assert(comms.length >= 3, `Expected 3+ communication integrations, got ${comms.length}`);
    for (const c of comms) {
      assertEqual(c.category, 'communication');
    }
  });

  test('Registry: toJSON structure is correct', () => {
    const slack = registry.get('slack');
    const json = slack.toJSON();
    assert(json.id === 'slack', 'id');
    assert(json.name === 'Slack', 'name');
    assert(json.category === 'communication', 'category');
    assert(json.icon === 'MessageSquare', 'icon');
    assert(Array.isArray(json.configFields), 'configFields should be array');
    assert(Array.isArray(json.actions), 'actions should be array');
    assert(json.actions.includes('send_message'), 'should include send_message action');
    assertEqual(json.connected, false, 'should be disconnected');
  });

  // ─── 2. Slack Integration Tests ─────────────────────────
  console.log('--- Slack ---');
  
  test('Slack: has correct config fields', () => {
    assert(slackConfig.configFields.length >= 2, 'Should have at least 2 config fields');
    const botToken = slackConfig.configFields.find(f => f.key === 'bot_token');
    assert(botToken, 'Missing bot_token field');
    assertEqual(botToken.type, 'password');
    assertEqual(botToken.required, true);
  });

  test('Slack: has all 5 actions', () => {
    const actions = Object.keys(slackConfig.actions);
    assert(actions.includes('send_message'), 'Missing send_message');
    assert(actions.includes('list_channels'), 'Missing list_channels');
    assert(actions.includes('read_messages'), 'Missing read_messages');
    assert(actions.includes('add_reaction'), 'Missing add_reaction');
    assert(actions.includes('set_topic'), 'Missing set_topic');
    assertEqual(actions.length, 5, `Expected 5 actions, got ${actions.length}`);
  });

  await testAsync('Slack: test() with invalid token returns failure gracefully', async () => {
    const result = await slackConfig.test({ bot_token: 'xoxb-fake-token-12345' });
    assertEqual(result.success, false, 'Should fail with fake token');
    assert(result.message, 'Should have error message');
    assert(result.message.length > 0, 'Error message should not be empty');
  });

  await testAsync('Slack: connect() with invalid token throws', async () => {
    try {
      await slackConfig.connect({ bot_token: 'xoxb-fake-token-12345' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message, 'Should have error message');
      // The error should be from Slack API, not a crash
      assert(!err.message.includes('Cannot read'), 'Should not be a TypeError');
    }
  });

  // ─── 3. Discord Integration Tests ──────────────────────
  console.log('--- Discord ---');

  test('Discord: has correct config fields', () => {
    assert(discordConfig.configFields.length >= 2, 'Should have at least 2 config fields');
    const botToken = discordConfig.configFields.find(f => f.key === 'bot_token');
    assert(botToken, 'Missing bot_token field');
    assertEqual(botToken.required, true);
  });

  test('Discord: has all 5 actions', () => {
    const actions = Object.keys(discordConfig.actions);
    assert(actions.includes('send_message'), 'Missing send_message');
    assert(actions.includes('list_guilds'), 'Missing list_guilds');
    assert(actions.includes('list_channels'), 'Missing list_channels');
    assert(actions.includes('read_messages'), 'Missing read_messages');
    assert(actions.includes('create_thread'), 'Missing create_thread');
    assertEqual(actions.length, 5);
  });

  await testAsync('Discord: test() with invalid token returns failure gracefully', async () => {
    const result = await discordConfig.test({ bot_token: 'fake-discord-token-12345' });
    assertEqual(result.success, false, 'Should fail with fake token');
    assert(result.message, 'Should have error message');
  });

  await testAsync('Discord: connect() with invalid token throws', async () => {
    try {
      await discordConfig.connect({ bot_token: 'fake-discord-token-12345' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message, 'Should have error message');
      assert(!err.message.includes('Cannot read'), 'Should not be a TypeError');
    }
  });

  await testAsync('Discord: send_message requires channel_id', async () => {
    try {
      await discordConfig.actions.send_message({ content: 'test' }, {});
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('channel_id required'), `Expected channel_id error, got: ${err.message}`);
    }
  });

  // ─── 4. Twilio Integration Tests ───────────────────────
  console.log('--- Twilio ---');

  test('Twilio: has correct config fields', () => {
    assert(twilioConfig.configFields.length >= 3, 'Should have at least 3 config fields');
    const sid = twilioConfig.configFields.find(f => f.key === 'account_sid');
    const token = twilioConfig.configFields.find(f => f.key === 'auth_token');
    const phone = twilioConfig.configFields.find(f => f.key === 'from_number');
    assert(sid && sid.required, 'account_sid should be required');
    assert(token && token.required, 'auth_token should be required');
    assert(phone && phone.required, 'from_number should be required');
  });

  test('Twilio: has all 5 actions', () => {
    const actions = Object.keys(twilioConfig.actions);
    assert(actions.includes('send_sms'), 'Missing send_sms');
    assert(actions.includes('send_whatsapp'), 'Missing send_whatsapp');
    assert(actions.includes('make_call'), 'Missing make_call');
    assert(actions.includes('list_messages'), 'Missing list_messages');
    assert(actions.includes('check_balance'), 'Missing check_balance');
    assertEqual(actions.length, 5);
  });

  await testAsync('Twilio: test() with invalid creds returns failure gracefully', async () => {
    const result = await twilioConfig.test({ account_sid: 'AC_fake_sid', auth_token: 'fake_token' });
    assertEqual(result.success, false, 'Should fail with fake creds');
    assert(result.message, 'Should have error message');
  });

  await testAsync('Twilio: send_sms validates required params', async () => {
    try {
      await twilioConfig.actions.send_sms({}, { account_sid: 'x', auth_token: 'x', from_number: '+1' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('Missing required'), `Expected validation error, got: ${err.message}`);
    }
  });

  // ─── 5. Google Sheets Integration Tests ────────────────
  console.log('--- Google Sheets ---');

  test('Google Sheets: has correct config fields', () => {
    assert(gsheetsConfig.configFields.length >= 2, 'Should have at least 2 config fields');
    const apiKey = gsheetsConfig.configFields.find(f => f.key === 'api_key');
    assert(apiKey && apiKey.required, 'api_key should be required');
  });

  test('Google Sheets: has all 3 actions', () => {
    const actions = Object.keys(gsheetsConfig.actions);
    assert(actions.includes('read_range'), 'Missing read_range');
    assert(actions.includes('get_spreadsheet_info'), 'Missing get_spreadsheet_info');
    assert(actions.includes('search_cells'), 'Missing search_cells');
    assertEqual(actions.length, 3);
  });

  await testAsync('Google Sheets: test() without spreadsheet ID gives partial success', async () => {
    const result = await gsheetsConfig.test({ api_key: 'fake-key' });
    // No spreadsheet ID → should say key is set but no sheet to verify
    assertEqual(result.success, true, 'Should succeed (key-only test)');
    assert(result.message.includes('no spreadsheet'), `Expected no-spreadsheet message, got: ${result.message}`);
  });

  await testAsync('Google Sheets: test() with fake key + spreadsheet fails gracefully', async () => {
    const result = await gsheetsConfig.test({ api_key: 'fake-key-123', default_spreadsheet_id: 'fake-sheet-id' });
    assertEqual(result.success, false, 'Should fail with fake key');
    assert(result.message, 'Should have error message');
  });

  await testAsync('Google Sheets: read_range requires spreadsheet_id', async () => {
    try {
      await gsheetsConfig.actions.read_range({}, {});
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('spreadsheet_id required'), `Expected spreadsheet_id error, got: ${err.message}`);
    }
  });

  // ─── 6. Database Integration Tests (Full E2E with SQLite) ─
  console.log('--- Database (SQLite E2E) ---');

  // Create a temp SQLite database for testing
  const tmpDir = os.tmpdir();
  const testDbPath = path.join(tmpDir, `dax_test_${Date.now()}.sqlite`);
  
  // Create the test database with sql.js
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const testDb = new SQL.Database();
  testDb.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, active INTEGER)`);
  testDb.run(`INSERT INTO users VALUES (1, 'Alice', 'alice@example.com', 1)`);
  testDb.run(`INSERT INTO users VALUES (2, 'Bob', 'bob@example.com', 1)`);
  testDb.run(`INSERT INTO users VALUES (3, 'Charlie', 'charlie@example.com', 0)`);
  testDb.run(`CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, product TEXT, amount REAL)`);
  testDb.run(`INSERT INTO orders VALUES (1, 1, 'Widget', 29.99)`);
  testDb.run(`INSERT INTO orders VALUES (2, 2, 'Gadget', 49.99)`);
  testDb.run(`INSERT INTO orders VALUES (3, 1, 'Doohickey', 9.99)`);
  
  // Write to disk
  const data = testDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(testDbPath, buffer);
  testDb.close();
  
  console.log(`  Test DB created at: ${testDbPath}`);

  const dbCreds = { type: 'sqlite', connection_string: `sqlite:///${testDbPath}` };

  test('Database: has correct config fields', () => {
    assert(dbConfig.configFields.length >= 2, 'Should have config fields');
    const typeField = dbConfig.configFields.find(f => f.key === 'type');
    assert(typeField, 'Missing type field');
    assert(typeField.options.includes('sqlite'), 'Should support sqlite');
    assert(typeField.options.includes('postgresql'), 'Should support postgresql');
    assert(typeField.options.includes('mysql'), 'Should support mysql');
  });

  test('Database: has all 3 actions', () => {
    const actions = Object.keys(dbConfig.actions);
    assert(actions.includes('query'), 'Missing query');
    assert(actions.includes('list_tables'), 'Missing list_tables');
    assert(actions.includes('describe_table'), 'Missing describe_table');
    assertEqual(actions.length, 3);
  });

  await testAsync('Database: test() with valid SQLite path succeeds', async () => {
    const result = await dbConfig.test(dbCreds);
    assertEqual(result.success, true, `Test should pass, got: ${result.message}`);
    assert(result.message.includes('SQLite database found'), result.message);
  });

  await testAsync('Database: test() with missing file returns failure', async () => {
    const result = await dbConfig.test({ type: 'sqlite', connection_string: 'sqlite:///nonexistent/path.db' });
    assertEqual(result.success, false, 'Should fail for missing file');
  });

  await testAsync('Database: list_tables returns correct tables', async () => {
    const tables = await dbConfig.actions.list_tables({}, dbCreds);
    assert(Array.isArray(tables), 'Should return array');
    assert(tables.includes('users'), `Should include users, got: ${tables}`);
    assert(tables.includes('orders'), `Should include orders, got: ${tables}`);
  });

  await testAsync('Database: describe_table shows columns', async () => {
    const columns = await dbConfig.actions.describe_table({ table: 'users' }, dbCreds);
    assert(Array.isArray(columns), 'Should return array');
    assertEqual(columns.length, 4, `Expected 4 columns, got ${columns.length}`);
    const names = columns.map(c => c.name);
    assert(names.includes('id'), 'Missing id column');
    assert(names.includes('name'), 'Missing name column');
    assert(names.includes('email'), 'Missing email column');
    assert(names.includes('active'), 'Missing active column');
    // Check id is primary key
    const idCol = columns.find(c => c.name === 'id');
    assertEqual(idCol.primary_key, true, 'id should be primary key');
    assertEqual(idCol.type, 'INTEGER', 'id should be INTEGER');
  });

  await testAsync('Database: query SELECT returns correct data', async () => {
    const result = await dbConfig.actions.query({ sql: 'SELECT * FROM users ORDER BY id' }, dbCreds);
    assert(result.columns, 'Should have columns');
    assert(result.rows, 'Should have rows');
    assertEqual(result.count, 3, `Expected 3 rows, got ${result.count}`);
    assertEqual(result.rows[0].name, 'Alice');
    assertEqual(result.rows[1].name, 'Bob');
    assertEqual(result.rows[2].name, 'Charlie');
  });

  await testAsync('Database: query with WHERE clause works', async () => {
    const result = await dbConfig.actions.query({ sql: 'SELECT * FROM users WHERE active = 1' }, dbCreds);
    assertEqual(result.count, 2, `Expected 2 active users, got ${result.count}`);
  });

  await testAsync('Database: query JOIN works', async () => {
    const result = await dbConfig.actions.query({
      sql: 'SELECT u.name, o.product, o.amount FROM users u JOIN orders o ON u.id = o.user_id ORDER BY o.id'
    }, dbCreds);
    assertEqual(result.count, 3, `Expected 3 orders, got ${result.count}`);
    assertEqual(result.rows[0].name, 'Alice');
    assertEqual(result.rows[0].product, 'Widget');
  });

  await testAsync('Database: query aggregate works', async () => {
    const result = await dbConfig.actions.query({
      sql: 'SELECT COUNT(*) as total, SUM(amount) as total_amount FROM orders'
    }, dbCreds);
    assertEqual(result.rows[0].total, 3);
    assert(Math.abs(result.rows[0].total_amount - 89.97) < 0.01, `Expected ~89.97, got ${result.rows[0].total_amount}`);
  });

  await testAsync('Database: blocks DROP without allow_write', async () => {
    try {
      await dbConfig.actions.query({ sql: 'DROP TABLE users' }, dbCreds);
      throw new Error('Should have blocked');
    } catch (err) {
      assert(err.message.includes('Blocked destructive'), `Expected blocked message, got: ${err.message}`);
    }
  });

  await testAsync('Database: blocks DELETE FROM without allow_write', async () => {
    try {
      await dbConfig.actions.query({ sql: 'DELETE FROM users' }, dbCreds);
      throw new Error('Should have blocked');
    } catch (err) {
      assert(err.message.includes('Blocked destructive'), `Expected blocked message, got: ${err.message}`);
    }
  });

  await testAsync('Database: blocks UPDATE without allow_write', async () => {
    try {
      await dbConfig.actions.query({ sql: 'UPDATE users SET active = 0' }, dbCreds);
      throw new Error('Should have blocked');
    } catch (err) {
      assert(err.message.includes('Blocked destructive'), `Expected blocked message, got: ${err.message}`);
    }
  });

  await testAsync('Database: blocks TRUNCATE without allow_write', async () => {
    try {
      await dbConfig.actions.query({ sql: 'TRUNCATE TABLE users' }, dbCreds);
      throw new Error('Should have blocked');
    } catch (err) {
      assert(err.message.includes('Blocked destructive'), `Expected blocked message, got: ${err.message}`);
    }
  });

  await testAsync('Database: allows INSERT (not in block list)', async () => {
    const result = await dbConfig.actions.query({
      sql: "INSERT INTO users VALUES (4, 'Dave', 'dave@example.com', 1)"
    }, dbCreds);
    // INSERT should not be blocked — but note: sql.js opens fresh each time so this won't persist
    // Actually it reads from file each call, so let's verify the data is there by querying fresh
    // The insert happened on an in-memory copy, so this is more about "not blocked" 
    assert(true, 'INSERT was not blocked');
  });

  await testAsync('Database: query requires sql param', async () => {
    try {
      await dbConfig.actions.query({}, dbCreds);
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('sql parameter required'), `Expected sql required, got: ${err.message}`);
    }
  });

  await testAsync('Database: describe_table requires table param', async () => {
    try {
      await dbConfig.actions.describe_table({}, dbCreds);
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('table parameter required'), `Expected table required, got: ${err.message}`);
    }
  });

  await testAsync('Database: postgresql requires external driver', async () => {
    try {
      await dbConfig.actions.query({ sql: 'SELECT 1' }, { type: 'postgresql' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('requires external driver'), `Expected driver error, got: ${err.message}`);
    }
  });

  // ─── 7. Integration Registry: connect/disconnect lifecycle ──
  console.log('--- Integration Lifecycle ---');

  await testAsync('Registry: connect → connected becomes true', async () => {
    const db = registry.get('database');
    // Database connect doesn't call any API, just stores creds
    // (test() is a separate method)
    try {
      await db.connect(dbCreds);
    } catch {
      // database.connect is not implemented — it sets creds
    }
    // After connect, should be connected
    assertEqual(db.connected, true, 'Should be connected after connect()');
  });

  await testAsync('Registry: executeAction works on connected integration', async () => {
    const db = registry.get('database');
    db.credentials = dbCreds;
    db.connected = true;
    const tables = await db.executeAction('list_tables', {});
    assert(Array.isArray(tables), 'Should return tables');
    assert(tables.includes('users'), 'Should include users table');
  });

  await testAsync('Registry: executeAction throws on unknown action', async () => {
    const db = registry.get('database');
    try {
      await db.executeAction('nonexistent_action', {});
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('Unknown action'), `Expected unknown action error, got: ${err.message}`);
    }
  });

  await testAsync('Registry: disconnect → connected becomes false', async () => {
    const db = registry.get('database');
    await db.disconnect();
    assertEqual(db.connected, false, 'Should be disconnected');
    assertEqual(Object.keys(db.credentials).length, 0, 'Credentials should be cleared');
  });

  await testAsync('Registry: getActions returns action names', async () => {
    const db = registry.get('database');
    const actions = db.getActions();
    assert(Array.isArray(actions), 'Should return array');
    assert(actions.includes('query'), 'Should include query');
    assert(actions.includes('list_tables'), 'Should include list_tables');
    assert(actions.includes('describe_table'), 'Should include describe_table');
  });

  // ─── 8. Tool Registry Integration ─────────────────────
  console.log('--- Tool Registry ---');

  test('Registry: registerWithToolRegistry creates tools for connected integrations', () => {
    // Create a mock tool registry
    const registeredTools = [];
    const mockToolRegistry = {
      register: (tool) => registeredTools.push(tool),
    };

    // Connect database
    const db = registry.get('database');
    db.connected = true;
    db.credentials = dbCreds;

    registry.registerWithToolRegistry(mockToolRegistry);
    
    // Should have registered tools for the connected database integration
    const dbTools = registeredTools.filter(t => t.name.startsWith('integration_database_'));
    assert(dbTools.length === 3, `Expected 3 database tools, got ${dbTools.length}`);
    assert(dbTools.some(t => t.name === 'integration_database_query'), 'Missing query tool');
    assert(dbTools.some(t => t.name === 'integration_database_list_tables'), 'Missing list_tables tool');
    assert(dbTools.some(t => t.name === 'integration_database_describe_table'), 'Missing describe_table tool');
    
    // Verify tool descriptions
    for (const tool of dbTools) {
      assert(tool.description.includes('[Database]'), `Tool desc should include [Database]: ${tool.description}`);
    }
    
    // Cleanup
    db.connected = false;
    db.credentials = {};
  });

  // ─── Cleanup ──────────────────────────────────────────
  try {
    fs.unlinkSync(testDbPath);
    console.log(`\n  Cleaned up test DB: ${testDbPath}`);
  } catch {}

  // ─── Summary ──────────────────────────────────────────
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
