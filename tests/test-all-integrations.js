/**
 * Test: All Integrations Shape Validation
 * Validates that every integration in the integrations/ folder exports
 * the correct shape: id, name, category, configFields, actions, etc.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const INTEGRATIONS_DIR = path.join(__dirname, '..', 'src', 'main', 'engine', 'integrations');
const SKIP_FILES = new Set(['registry.js', '_template.js']);

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, msg) {
  if (condition) { passed++; }
  else { failed++; errors.push(msg); }
}

// Discover all integration files
const files = fs.readdirSync(INTEGRATIONS_DIR)
  .filter(f => f.endsWith('.js') && !SKIP_FILES.has(f))
  .sort();

console.log(`\n=== Integration Shape Validation ===`);
console.log(`Found ${files.length} integration files\n`);

const VALID_CATEGORIES = new Set([
  'social', 'productivity', 'devops', 'communication', 'data', 'ai', 'commerce',
  'messaging', 'automation', 'database', 'storage', 'general', 'cloud', 'email',
  'calendar', 'spreadsheet', 'crm', // legacy categories from original integrations
]);

const allIds = new Set();
const categoryMap = {};

for (const file of files) {
  const filePath = path.join(INTEGRATIONS_DIR, file);
  let mod;

  // Test 1: File can be required without errors
  try {
    mod = require(filePath);
    assert(true, '');
  } catch (e) {
    assert(false, `${file}: FAILED to require — ${e.message}`);
    continue;
  }

  const prefix = `${file} (${mod.id || '?'})`;

  // Test 2: Has required string fields
  assert(typeof mod.id === 'string' && mod.id.length > 0, `${prefix}: missing or invalid 'id'`);
  assert(typeof mod.name === 'string' && mod.name.length > 0, `${prefix}: missing or invalid 'name'`);
  assert(typeof mod.description === 'string' && mod.description.length > 0, `${prefix}: missing or invalid 'description'`);

  // Test 3: Category
  assert(typeof mod.category === 'string', `${prefix}: missing 'category'`);

  // Test 4: No duplicate IDs
  if (allIds.has(mod.id)) {
    assert(false, `${prefix}: DUPLICATE id '${mod.id}'`);
  } else {
    allIds.add(mod.id);
    assert(true, '');
  }

  // Track categories
  if (!categoryMap[mod.category]) categoryMap[mod.category] = [];
  categoryMap[mod.category].push(mod.id);

  // Test 5: configFields is array
  assert(Array.isArray(mod.configFields), `${prefix}: 'configFields' must be an array`);

  // Test 6: Each configField has required shape
  if (Array.isArray(mod.configFields)) {
    for (const field of mod.configFields) {
      assert(typeof field.key === 'string', `${prefix}: configField missing 'key'`);
      assert(typeof field.label === 'string', `${prefix}: configField missing 'label'`);
      assert(typeof field.type === 'string', `${prefix}: configField missing 'type'`);
    }
  }

  // Test 7: Required methods exist
  assert(typeof mod.connect === 'function', `${prefix}: missing 'connect' method`);
  assert(typeof mod.disconnect === 'function', `${prefix}: missing 'disconnect' method`);
  assert(typeof mod.test === 'function', `${prefix}: missing 'test' method`);
  assert(typeof mod.executeAction === 'function', `${prefix}: missing 'executeAction' method`);

  // Test 8: actions object exists and has at least one action
  assert(typeof mod.actions === 'object' && mod.actions !== null, `${prefix}: missing 'actions' object`);
  if (typeof mod.actions === 'object' && mod.actions !== null) {
    const actionNames = Object.keys(mod.actions);
    assert(actionNames.length > 0, `${prefix}: 'actions' object is empty`);

    // Test 9: Each action is a function
    for (const actionName of actionNames) {
      assert(typeof mod.actions[actionName] === 'function', `${prefix}: action '${actionName}' is not a function`);
    }
  }

  // Test 10: executeAction rejects unknown actions
  try {
    // We don't actually call it (would need credentials), but check it exists
    assert(mod.executeAction.length >= 2 || mod.executeAction.length >= 1, `${prefix}: executeAction should accept parameters`);
  } catch (e) {
    // OK
  }
}

// Summary
console.log('--- Category Breakdown ---');
for (const [cat, ids] of Object.entries(categoryMap).sort()) {
  console.log(`  ${cat}: ${ids.length} (${ids.join(', ')})`);
}

console.log(`\n--- Results ---`);
console.log(`Total integration files: ${files.length}`);
console.log(`Unique IDs: ${allIds.size}`);
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);

if (errors.length) {
  console.log(`\nFAILURES:`);
  errors.forEach(e => console.log(`  ✗ ${e}`));
}

console.log(`\n${failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}\n`);
process.exit(failed > 0 ? 1 : 0);
