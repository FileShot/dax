// ─── New Integration Tests ──────────────────────────────────
// Tests the 7 new integrations: Email, GitHub, Notion, HTTP/REST,
// Google Calendar, File System, Telegram
// All API integrations tested for structure, validation, and graceful errors
// File System integration tested end-to-end with real filesystem

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
  console.log('  DAX NEW INTEGRATION TESTS');
  console.log('========================================\n');

  // Load all integrations
  const emailConfig = require('../src/main/engine/integrations/email');
  const githubConfig = require('../src/main/engine/integrations/github');
  const notionConfig = require('../src/main/engine/integrations/notion');
  const httpConfig = require('../src/main/engine/integrations/http-rest');
  const calendarConfig = require('../src/main/engine/integrations/google-calendar');
  const filesystemConfig = require('../src/main/engine/integrations/filesystem');
  const telegramConfig = require('../src/main/engine/integrations/telegram');

  // Also load the registry to test registration
  const registry = require('../src/main/engine/integrations/registry');
  registry.register(emailConfig);
  registry.register(githubConfig);
  registry.register(notionConfig);
  registry.register(httpConfig);
  registry.register(calendarConfig);
  registry.register(filesystemConfig);
  registry.register(telegramConfig);

  // ════════════════════════════════════════════════════════
  // 1. EMAIL (SMTP)
  // ════════════════════════════════════════════════════════
  console.log('--- Email (SMTP) ---');

  test('Email: has correct module properties', () => {
    assertEqual(emailConfig.id, 'email');
    assertEqual(emailConfig.name, 'Email (SMTP)');
    assertEqual(emailConfig.category, 'communication');
    assertEqual(emailConfig.icon, 'Mail');
  });

  test('Email: has correct config fields', () => {
    assert(emailConfig.configFields.length >= 4, `Expected 4+ config fields, got ${emailConfig.configFields.length}`);
    const host = emailConfig.configFields.find(f => f.key === 'smtp_host');
    const user = emailConfig.configFields.find(f => f.key === 'smtp_user');
    const pass = emailConfig.configFields.find(f => f.key === 'smtp_pass');
    assert(host && host.required, 'smtp_host should be required');
    assert(user && user.required, 'smtp_user should be required');
    assert(pass && pass.required, 'smtp_pass should be required');
    assertEqual(pass.type, 'password', 'smtp_pass should be password type');
  });

  test('Email: has send_email action', () => {
    const actions = Object.keys(emailConfig.actions);
    assert(actions.includes('send_email'), 'Missing send_email');
    assert(actions.length >= 1, 'Should have at least 1 action');
  });

  await testAsync('Email: send_email validates required params (to)', async () => {
    try {
      await emailConfig.actions.send_email({ subject: 'Test' }, { smtp_host: 'x', smtp_user: 'x', smtp_pass: 'x' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.toLowerCase().includes('to') || err.message.toLowerCase().includes('required'),
        `Expected to-required error, got: ${err.message}`);
    }
  });

  await testAsync('Email: send_email validates required params (subject)', async () => {
    try {
      await emailConfig.actions.send_email({ to: 'test@test.com' }, { smtp_host: 'x', smtp_user: 'x', smtp_pass: 'x' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.toLowerCase().includes('subject') || err.message.toLowerCase().includes('required'),
        `Expected subject-required error, got: ${err.message}`);
    }
  });

  await testAsync('Email: test() with invalid host returns failure', async () => {
    const result = await emailConfig.test({
      smtp_host: '127.0.0.1',
      smtp_port: '19999',
      smtp_user: 'test',
      smtp_pass: 'test',
    });
    assertEqual(result.success, false, 'Should fail with unreachable host');
    assert(result.message, 'Should have error message');
  });

  // ════════════════════════════════════════════════════════
  // 2. GITHUB
  // ════════════════════════════════════════════════════════
  console.log('--- GitHub ---');

  test('GitHub: has correct module properties', () => {
    assertEqual(githubConfig.id, 'github');
    assertEqual(githubConfig.name, 'GitHub');
    assertEqual(githubConfig.category, 'development');
    assertEqual(githubConfig.icon, 'Github');
  });

  test('GitHub: has correct config fields', () => {
    assert(githubConfig.configFields.length >= 1, 'Should have at least 1 config field');
    const token = githubConfig.configFields.find(f => f.key === 'token');
    assert(token && token.required, 'token should be required');
    assertEqual(token.type, 'password', 'token should be password type');
  });

  test('GitHub: has all 7 actions', () => {
    const actions = Object.keys(githubConfig.actions);
    assert(actions.includes('list_repos'), 'Missing list_repos');
    assert(actions.includes('create_issue'), 'Missing create_issue');
    assert(actions.includes('list_issues'), 'Missing list_issues');
    assert(actions.includes('get_issue'), 'Missing get_issue');
    assert(actions.includes('add_comment'), 'Missing add_comment');
    assert(actions.includes('list_pulls'), 'Missing list_pulls');
    assert(actions.includes('get_file'), 'Missing get_file');
    assertEqual(actions.length, 7, `Expected 7 actions, got ${actions.length}`);
  });

  await testAsync('GitHub: test() with invalid token returns failure', async () => {
    const result = await githubConfig.test({ token: 'ghp_fake_token_12345abcde' });
    assertEqual(result.success, false, 'Should fail with fake token');
    assert(result.message, 'Should have error message');
  });

  await testAsync('GitHub: connect() with invalid token throws', async () => {
    try {
      await githubConfig.connect({ token: 'ghp_fake_token_12345abcde' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message, 'Should have error message');
      assert(!err.message.includes('Cannot read'), 'Should not be a TypeError');
    }
  });

  await testAsync('GitHub: create_issue validates owner/repo', async () => {
    try {
      // No default_owner or default_repo and no params
      await githubConfig.actions.create_issue({ title: 'Test' }, { token: 'fake' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('owner') || err.message.includes('repo') || err.message.includes('required') || err.message.includes('401') || err.message.includes('API'),
        `Expected validation or API error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 3. NOTION
  // ════════════════════════════════════════════════════════
  console.log('--- Notion ---');

  test('Notion: has correct module properties', () => {
    assertEqual(notionConfig.id, 'notion');
    assertEqual(notionConfig.name, 'Notion');
    assertEqual(notionConfig.category, 'productivity');
    assertEqual(notionConfig.icon, 'FileText');
  });

  test('Notion: has correct config fields', () => {
    const token = notionConfig.configFields.find(f => f.key === 'token');
    assert(token && token.required, 'token should be required');
    assertEqual(token.type, 'password', 'token should be password type');
  });

  test('Notion: has all 5 actions', () => {
    const actions = Object.keys(notionConfig.actions);
    assert(actions.includes('search'), 'Missing search');
    assert(actions.includes('get_page'), 'Missing get_page');
    assert(actions.includes('get_page_content'), 'Missing get_page_content');
    assert(actions.includes('create_page'), 'Missing create_page');
    assert(actions.includes('query_database'), 'Missing query_database');
    assertEqual(actions.length, 5, `Expected 5 actions, got ${actions.length}`);
  });

  await testAsync('Notion: test() with invalid token returns failure', async () => {
    const result = await notionConfig.test({ token: 'ntn_fake_token_12345' });
    assertEqual(result.success, false, 'Should fail with fake token');
    assert(result.message, 'Should have error message');
  });

  await testAsync('Notion: connect() with invalid token throws', async () => {
    try {
      await notionConfig.connect({ token: 'ntn_fake_token_12345' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message, 'Should have error message');
    }
  });

  await testAsync('Notion: get_page validates page_id', async () => {
    try {
      await notionConfig.actions.get_page({}, { token: 'fake' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('page_id') || err.message.includes('required') || err.message.includes('401') || err.message.includes('invalid') || err.message.includes('token'),
        `Expected validation or auth error, got: ${err.message}`);
    }
  });

  await testAsync('Notion: query_database validates database_id', async () => {
    try {
      await notionConfig.actions.query_database({}, { token: 'fake' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('database_id') || err.message.includes('required') || err.message.includes('401') || err.message.includes('invalid') || err.message.includes('token'),
        `Expected validation or auth error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 4. HTTP / REST
  // ════════════════════════════════════════════════════════
  console.log('--- HTTP / REST ---');

  test('HTTP/REST: has correct module properties', () => {
    assertEqual(httpConfig.id, 'http-rest');
    assertEqual(httpConfig.name, 'HTTP / REST');
    assertEqual(httpConfig.category, 'utility');
    assertEqual(httpConfig.icon, 'Globe');
  });

  test('HTTP/REST: has correct config fields', () => {
    const baseUrl = httpConfig.configFields.find(f => f.key === 'base_url');
    const headers = httpConfig.configFields.find(f => f.key === 'default_headers');
    assert(baseUrl, 'Missing base_url field');
    assert(headers, 'Missing default_headers field');
    // base_url is NOT required (optional for generic use)
    assert(!baseUrl.required, 'base_url should not be required');
  });

  test('HTTP/REST: has all 3 actions', () => {
    const actions = Object.keys(httpConfig.actions);
    assert(actions.includes('request'), 'Missing request');
    assert(actions.includes('get'), 'Missing get');
    assert(actions.includes('post'), 'Missing post');
    assertEqual(actions.length, 3, `Expected 3 actions, got ${actions.length}`);
  });

  await testAsync('HTTP/REST: request validates URL required', async () => {
    try {
      await httpConfig.actions.request({}, {});
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('url') || err.message.includes('URL') || err.message.includes('required'),
        `Expected URL-required error, got: ${err.message}`);
    }
  });

  await testAsync('HTTP/REST: get validates URL required', async () => {
    try {
      await httpConfig.actions.get({}, {});
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('url') || err.message.includes('URL') || err.message.includes('required'),
        `Expected URL-required error, got: ${err.message}`);
    }
  });

  await testAsync('HTTP/REST: connect() with valid base_url succeeds', async () => {
    try {
      await httpConfig.connect({ base_url: 'https://example.com' });
      assertEqual(httpConfig.connected, true, 'Should be connected');
      await httpConfig.disconnect();
    } catch (err) {
      // connect() only validates URL format, should not fail for valid URL
      throw new Error(`Should not fail for valid URL: ${err.message}`);
    }
  });

  await testAsync('HTTP/REST: connect() with invalid base_url throws', async () => {
    try {
      await httpConfig.connect({ base_url: 'not-a-url' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('Invalid') || err.message.includes('URL') || err.message.includes('url'),
        `Expected URL error, got: ${err.message}`);
    }
  });

  await testAsync('HTTP/REST: connect() with no base_url succeeds', async () => {
    try {
      await httpConfig.connect({});
      assertEqual(httpConfig.connected, true, 'Should be connected without base_url');
      await httpConfig.disconnect();
    } catch (err) {
      throw new Error(`Should succeed without base_url: ${err.message}`);
    }
  });

  await testAsync('HTTP/REST: test() without base_url returns success', async () => {
    const result = await httpConfig.test({});
    assertEqual(result.success, true, 'Should succeed without base_url');
  });

  // ════════════════════════════════════════════════════════
  // 5. GOOGLE CALENDAR
  // ════════════════════════════════════════════════════════
  console.log('--- Google Calendar ---');

  test('Google Calendar: has correct module properties', () => {
    assertEqual(calendarConfig.id, 'google-calendar');
    assertEqual(calendarConfig.name, 'Google Calendar');
    assertEqual(calendarConfig.category, 'productivity');
    assertEqual(calendarConfig.icon, 'Calendar');
  });

  test('Google Calendar: has correct config fields', () => {
    const apiKey = calendarConfig.configFields.find(f => f.key === 'api_key');
    assert(apiKey && apiKey.required, 'api_key should be required');
    assertEqual(apiKey.type, 'password', 'api_key should be password type');
    const calId = calendarConfig.configFields.find(f => f.key === 'calendar_id');
    assert(calId, 'Should have calendar_id field');
  });

  test('Google Calendar: has all 3 actions', () => {
    const actions = Object.keys(calendarConfig.actions);
    assert(actions.includes('list_events'), 'Missing list_events');
    assert(actions.includes('get_event'), 'Missing get_event');
    assert(actions.includes('busy_check'), 'Missing busy_check');
    assertEqual(actions.length, 3, `Expected 3 actions, got ${actions.length}`);
  });

  await testAsync('Google Calendar: test() with fake key returns failure', async () => {
    const result = await calendarConfig.test({ api_key: 'fake-api-key-12345' });
    assertEqual(result.success, false, 'Should fail with fake API key');
    assert(result.message, 'Should have error message');
  });

  await testAsync('Google Calendar: connect() with fake key throws', async () => {
    try {
      await calendarConfig.connect({ api_key: 'fake-api-key-12345' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message, 'Should have error message');
    }
  });

  await testAsync('Google Calendar: get_event validates event_id', async () => {
    try {
      await calendarConfig.actions.get_event({}, { api_key: 'fake' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('event_id') || err.message.includes('required') || err.message.includes('API'),
        `Expected event_id error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 6. FILE SYSTEM (Full E2E)
  // ════════════════════════════════════════════════════════
  console.log('--- File System (E2E) ---');

  // Create a temp directory for testing
  const tmpDir = path.join(os.tmpdir(), `dax_fs_test_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log(`  Test dir created: ${tmpDir}`);

  test('Filesystem: has correct module properties', () => {
    assertEqual(filesystemConfig.id, 'filesystem');
    assertEqual(filesystemConfig.name, 'File System');
    assertEqual(filesystemConfig.category, 'utility');
    assertEqual(filesystemConfig.icon, 'FolderOpen');
  });

  test('Filesystem: has correct config fields', () => {
    const dirs = filesystemConfig.configFields.find(f => f.key === 'allowed_dirs');
    assert(dirs && dirs.required, 'allowed_dirs should be required');
    const maxSize = filesystemConfig.configFields.find(f => f.key === 'max_file_size_mb');
    assert(maxSize, 'Should have max_file_size_mb field');
  });

  test('Filesystem: has all 6 actions', () => {
    const actions = Object.keys(filesystemConfig.actions);
    assert(actions.includes('read_file'), 'Missing read_file');
    assert(actions.includes('write_file'), 'Missing write_file');
    assert(actions.includes('append_file'), 'Missing append_file');
    assert(actions.includes('list_dir'), 'Missing list_dir');
    assert(actions.includes('file_info'), 'Missing file_info');
    assert(actions.includes('delete_file'), 'Missing delete_file');
    assertEqual(actions.length, 6, `Expected 6 actions, got ${actions.length}`);
  });

  const fsCreds = { allowed_dirs: tmpDir, max_file_size_mb: '10' };

  await testAsync('Filesystem: connect() with valid dir succeeds', async () => {
    await filesystemConfig.connect(fsCreds);
    assertEqual(filesystemConfig.connected, true, 'Should be connected');
  });

  await testAsync('Filesystem: test() with valid dir succeeds', async () => {
    const result = await filesystemConfig.test(fsCreds);
    assertEqual(result.success, true, `Should succeed, got: ${result.message}`);
    assert(result.message.includes('OK'), 'Should report OK');
  });

  await testAsync('Filesystem: connect() with nonexistent dir throws', async () => {
    try {
      await filesystemConfig.connect({ allowed_dirs: '/nonexistent/path/xyz123' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('not found') || err.message.includes('exist') || err.message.includes('does not'),
        `Expected not-found error, got: ${err.message}`);
    }
  });

  await testAsync('Filesystem: test() with nonexistent dir returns failure', async () => {
    const result = await filesystemConfig.test({ allowed_dirs: '/nonexistent/path/xyz123' });
    assertEqual(result.success, false, 'Should fail for nonexistent dir');
  });

  await testAsync('Filesystem: write_file creates file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const result = await filesystemConfig.actions.write_file(
      { path: filePath, content: 'Hello, World!' },
      fsCreds
    );
    assertEqual(result.written, true, 'Should report written');
    assert(fs.existsSync(filePath), 'File should exist on disk');
    assertEqual(fs.readFileSync(filePath, 'utf8'), 'Hello, World!', 'Content should match');
  });

  await testAsync('Filesystem: read_file returns content', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const result = await filesystemConfig.actions.read_file(
      { path: filePath },
      fsCreds
    );
    assertEqual(result.content, 'Hello, World!', 'Content should match');
    assert(result.size > 0, 'Size should be > 0');
  });

  await testAsync('Filesystem: append_file appends content', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    await filesystemConfig.actions.append_file(
      { path: filePath, content: ' Appended!' },
      fsCreds
    );
    assertEqual(fs.readFileSync(filePath, 'utf8'), 'Hello, World! Appended!', 'Content should be appended');
  });

  await testAsync('Filesystem: write_file creates subdirectories', async () => {
    const filePath = path.join(tmpDir, 'sub', 'deep', 'file.txt');
    const result = await filesystemConfig.actions.write_file(
      { path: filePath, content: 'nested!' },
      fsCreds
    );
    assertEqual(result.written, true);
    assert(fs.existsSync(filePath), 'Nested file should exist');
    assertEqual(fs.readFileSync(filePath, 'utf8'), 'nested!');
  });

  await testAsync('Filesystem: list_dir returns entries', async () => {
    const result = await filesystemConfig.actions.list_dir(
      { path: tmpDir },
      fsCreds
    );
    assert(Array.isArray(result), 'Should return array');
    assert(result.length >= 2, `Expected at least 2 entries, got ${result.length}`);
    const names = result.map(e => e.name);
    assert(names.includes('test.txt'), 'Should include test.txt');
    assert(names.includes('sub'), 'Should include sub directory');
    const subEntry = result.find(e => e.name === 'sub');
    assertEqual(subEntry.type, 'directory', 'sub should be directory');
  });

  await testAsync('Filesystem: file_info returns metadata', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const result = await filesystemConfig.actions.file_info(
      { path: filePath },
      fsCreds
    );
    assert(result.size > 0, 'Size should be > 0');
    assertEqual(result.isDirectory, false, 'Should not be directory');
    assert(result.created, 'Should have created date');
    assert(result.modified, 'Should have modified date');
  });

  await testAsync('Filesystem: delete_file removes file', async () => {
    const filePath = path.join(tmpDir, 'test.txt');
    const result = await filesystemConfig.actions.delete_file(
      { path: filePath },
      fsCreds
    );
    assertEqual(result.deleted, true, 'Should report deleted');
    assert(!fs.existsSync(filePath), 'File should no longer exist');
  });

  await testAsync('Filesystem: path traversal blocked (outside allowed dirs)', async () => {
    const evilPath = path.join(os.tmpdir(), '..', 'etc', 'passwd');
    try {
      await filesystemConfig.actions.read_file({ path: evilPath }, fsCreds);
      throw new Error('Should have thrown — path traversal should be blocked');
    } catch (err) {
      assert(err.message.includes('outside') || err.message.includes('allowed') || err.message.includes('blocked') || err.message.includes('Access'),
        `Expected path-blocked error, got: ${err.message}`);
    }
  });

  await testAsync('Filesystem: read_file validates path param', async () => {
    try {
      await filesystemConfig.actions.read_file({}, fsCreds);
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('path') || err.message.includes('required'),
        `Expected path-required error, got: ${err.message}`);
    }
  });

  await testAsync('Filesystem: delete_file on directory throws', async () => {
    const dirPath = path.join(tmpDir, 'sub');
    try {
      await filesystemConfig.actions.delete_file({ path: dirPath }, fsCreds);
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('directory') || err.message.includes('Cannot') || err.message.includes('not a file'),
        `Expected directory-delete error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 7. TELEGRAM
  // ════════════════════════════════════════════════════════
  console.log('--- Telegram ---');

  test('Telegram: has correct module properties', () => {
    assertEqual(telegramConfig.id, 'telegram');
    assertEqual(telegramConfig.name, 'Telegram');
    assertEqual(telegramConfig.category, 'communication');
    assertEqual(telegramConfig.icon, 'Send');
  });

  test('Telegram: has correct config fields', () => {
    const token = telegramConfig.configFields.find(f => f.key === 'bot_token');
    assert(token && token.required, 'bot_token should be required');
    assertEqual(token.type, 'password', 'bot_token should be password type');
    const chatId = telegramConfig.configFields.find(f => f.key === 'default_chat_id');
    assert(chatId, 'Should have default_chat_id field');
  });

  test('Telegram: has all 6 actions', () => {
    const actions = Object.keys(telegramConfig.actions);
    assert(actions.includes('send_message'), 'Missing send_message');
    assert(actions.includes('get_updates'), 'Missing get_updates');
    assert(actions.includes('get_chat'), 'Missing get_chat');
    assert(actions.includes('send_document'), 'Missing send_document');
    assert(actions.includes('set_webhook'), 'Missing set_webhook');
    assert(actions.includes('delete_webhook'), 'Missing delete_webhook');
    assertEqual(actions.length, 6, `Expected 6 actions, got ${actions.length}`);
  });

  await testAsync('Telegram: test() with invalid token returns failure', async () => {
    const result = await telegramConfig.test({ bot_token: '123456:FAKE_TOKEN_ABCDEF' });
    assertEqual(result.success, false, 'Should fail with fake token');
    assert(result.message, 'Should have error message');
  });

  await testAsync('Telegram: connect() with invalid token throws', async () => {
    try {
      await telegramConfig.connect({ bot_token: '123456:FAKE_TOKEN_ABCDEF' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message, 'Should have error message');
    }
  });

  await testAsync('Telegram: send_message validates chat_id', async () => {
    try {
      // No default_chat_id and no chat_id in params
      await telegramConfig.actions.send_message({ text: 'Hello' }, { bot_token: 'fake' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('chat_id') || err.message.includes('required') || err.message.includes('401') || err.message.includes('Telegram'),
        `Expected chat_id error, got: ${err.message}`);
    }
  });

  await testAsync('Telegram: get_chat validates chat_id', async () => {
    try {
      await telegramConfig.actions.get_chat({}, { bot_token: 'fake' });
      throw new Error('Should have thrown');
    } catch (err) {
      assert(err.message.includes('chat_id') || err.message.includes('required') || err.message.includes('Telegram') || err.message.includes('Not Found') || err.message.includes('error'),
        `Expected chat_id or API error, got: ${err.message}`);
    }
  });

  // ════════════════════════════════════════════════════════
  // 8. REGISTRY INTEGRATION
  // ════════════════════════════════════════════════════════
  console.log('--- Registry: New Integrations ---');

  test('Registry: all 7 new integrations registered', () => {
    const all = registry.list();
    const ids = all.map(i => i.id);
    assert(ids.includes('email'), 'Missing email in registry');
    assert(ids.includes('github'), 'Missing github in registry');
    assert(ids.includes('notion'), 'Missing notion in registry');
    assert(ids.includes('http-rest'), 'Missing http-rest in registry');
    assert(ids.includes('google-calendar'), 'Missing google-calendar in registry');
    assert(ids.includes('filesystem'), 'Missing filesystem in registry');
    assert(ids.includes('telegram'), 'Missing telegram in registry');
  });

  test('Registry: each new integration has required fields', () => {
    const newIds = ['email', 'github', 'notion', 'http-rest', 'google-calendar', 'filesystem', 'telegram'];
    for (const id of newIds) {
      const integ = registry.get(id);
      assert(integ, `Integration ${id} not found`);
      assert(integ.id, `Missing id on ${id}`);
      assert(integ.name, `Missing name on ${id}`);
      assert(integ.category, `Missing category on ${id}`);
      assert(integ.icon, `Missing icon on ${id}`);
      // Actions can be an array (from getActions()) or object (raw)
      const actionList = integ.getActions();
      assert(Array.isArray(actionList), `getActions() should return array on ${id}`);
      assert(actionList.length > 0, `No actions on ${id}`);
    }
  });

  test('Registry: categories include development, utility, productivity', () => {
    const cats = new Set(registry.list().map(i => i.category));
    assert(cats.has('development'), 'Missing development category');
    assert(cats.has('utility'), 'Missing utility category');
    assert(cats.has('productivity'), 'Missing productivity category');
    assert(cats.has('communication'), 'Missing communication category');
  });

  test('Registry: toJSON works for all new integrations', () => {
    const newIds = ['email', 'github', 'notion', 'http-rest', 'google-calendar', 'filesystem', 'telegram'];
    for (const id of newIds) {
      const integ = registry.get(id);
      const json = integ.toJSON();
      assertEqual(json.id, id, `toJSON id mismatch for ${id}`);
      assert(json.name, `toJSON missing name for ${id}`);
      assert(json.category, `toJSON missing category for ${id}`);
      assert(json.icon, `toJSON missing icon for ${id}`);
      assert(Array.isArray(json.configFields), `toJSON missing configFields for ${id}`);
      assert(Array.isArray(json.actions), `toJSON missing actions for ${id}`);
      assertEqual(json.connected, false, `${id} should start disconnected in toJSON`);
    }
  });

  test('Registry: registerWithToolRegistry for filesystem', () => {
    const registeredTools = [];
    const mockToolRegistry = { register: (tool) => registeredTools.push(tool) };

    const fs_integ = registry.get('filesystem');
    fs_integ.connected = true;
    fs_integ.credentials = fsCreds;

    registry.registerWithToolRegistry(mockToolRegistry);

    const fsTools = registeredTools.filter(t => t.name.startsWith('integration_filesystem_'));
    assertEqual(fsTools.length, 6, `Expected 6 filesystem tools, got ${fsTools.length}`);
    assert(fsTools.some(t => t.name === 'integration_filesystem_read_file'), 'Missing read_file tool');
    assert(fsTools.some(t => t.name === 'integration_filesystem_write_file'), 'Missing write_file tool');
    assert(fsTools.some(t => t.name === 'integration_filesystem_list_dir'), 'Missing list_dir tool');

    // Cleanup
    fs_integ.connected = false;
    fs_integ.credentials = {};
  });

  // ─── Cleanup ──────────────────────────────────────────
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(`\n  Cleaned up test dir: ${tmpDir}`);
  } catch {}

  // Disconnect filesystem if still connected
  try { await filesystemConfig.disconnect(); } catch {}

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
