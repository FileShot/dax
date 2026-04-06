// Use the same sql.js library as agent-service
const initSqlJs = require('C:/Users/brend/thing/dax/node_modules/sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = 'C:/Users/brend/AppData/Roaming/dax/dax.db';

async function main() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  const before = db.exec("SELECT id, name, enabled FROM agents");
  console.log('Before:', JSON.stringify(before[0]?.values));

  db.run("UPDATE agents SET enabled = 0 WHERE name IN ('sys-monitor', 'web-checker')");

  const after = db.exec("SELECT id, name, enabled FROM agents");
  console.log('After:', JSON.stringify(after[0]?.values));

  // Save back same way as agent-service
  const data = db.export();
  const tempPath = DB_PATH + '.tmp';
  fs.writeFileSync(tempPath, Buffer.from(data));
  fs.renameSync(tempPath, DB_PATH);
  console.log('Saved. DB file size:', fs.statSync(DB_PATH).size);
  db.close();
}

main().catch(console.error);
