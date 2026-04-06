const Database = require('better-sqlite3');
// Try to open the DB for writing
const db = new Database('C:/Users/brend/AppData/Roaming/dax/dax.db');
console.log('Before:');
const before = db.prepare('SELECT id, name, enabled FROM agents WHERE trigger_type = ?').all('schedule');
before.forEach(r => console.log(`  ${r.name}: enabled=${r.enabled}`));

db.prepare("UPDATE agents SET enabled = 0 WHERE trigger_type = 'schedule' AND name IN ('sys-monitor', 'web-checker')").run();
db.pragma('wal_checkpoint(FULL)');

console.log('After:');
const after = db.prepare('SELECT id, name, enabled FROM agents WHERE trigger_type = ?').all('schedule');
after.forEach(r => console.log(`  ${r.name}: enabled=${r.enabled}`));
db.close();
