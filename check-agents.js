const Database = require('better-sqlite3');
const db = new Database('C:/Users/brend/AppData/Roaming/dax/dax.db', {readonly: true});
const rows = db.prepare('SELECT id, name, enabled, trigger_type FROM agents').all();
console.log(JSON.stringify(rows, null, 2));
db.close();
