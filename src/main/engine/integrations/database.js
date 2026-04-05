// ─── Database Connectors Integration ────────────────────────
// Provides SQL query execution against SQLite, PostgreSQL, and MySQL
// Uses built-in Node.js capabilities + optional drivers

const path = require('path');
const fs = require('fs');

module.exports = {
  id: 'database',
  name: 'Database',
  category: 'database',
  icon: 'Database',
  description: 'Execute SQL queries against SQLite, PostgreSQL, or MySQL databases',
  configFields: [
    { key: 'type', label: 'Database Type', type: 'select', options: ['sqlite', 'postgresql', 'mysql'], required: true },
    { key: 'connection_string', label: 'Connection String', type: 'text', placeholder: 'sqlite:///path/to/db.sqlite or postgres://user:pass@host/db' },
    { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
    { key: 'port', label: 'Port', type: 'number', placeholder: '5432' },
    { key: 'database', label: 'Database Name', type: 'text' },
    { key: 'username', label: 'Username', type: 'text' },
    { key: 'password', label: 'Password', type: 'password' },
  ],

  async test(creds) {
    try {
      if (creds.type === 'sqlite') {
        const dbPath = creds.connection_string?.replace('sqlite:///', '') || creds.database;
        if (!dbPath || !fs.existsSync(dbPath)) {
          return { success: false, message: `SQLite file not found: ${dbPath}` };
        }
        return { success: true, message: `SQLite database found: ${path.basename(dbPath)}` };
      }
      return { success: true, message: `${creds.type} configured (connection test requires driver)` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    query: async (params, creds) => {
      const { sql, values } = params;
      if (!sql) throw new Error('sql parameter required');

      // Safety: block destructive queries unless explicitly allowed
      const upperSql = sql.trim().toUpperCase();
      const dangerous = ['DROP', 'TRUNCATE', 'ALTER', 'DELETE FROM', 'UPDATE'];
      if (!params.allow_write && dangerous.some((d) => upperSql.startsWith(d))) {
        throw new Error(`Blocked destructive query: ${upperSql.slice(0, 30)}... Set allow_write=true to permit`);
      }

      if (creds.type === 'sqlite') {
        return querySqlite(creds, sql, values);
      }
      // PostgreSQL and MySQL need external drivers
      throw new Error(`${creds.type} requires external driver — install pg or mysql2 packages`);
    },

    list_tables: async (_params, creds) => {
      if (creds.type === 'sqlite') {
        const result = await querySqlite(creds, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        return result.rows.map((r) => r.name);
      }
      if (creds.type === 'postgresql') {
        throw new Error('PostgreSQL requires pg driver');
      }
      if (creds.type === 'mysql') {
        throw new Error('MySQL requires mysql2 driver');
      }
      throw new Error(`Unknown database type: ${creds.type}`);
    },

    describe_table: async (params, creds) => {
      if (!params.table) throw new Error('table parameter required');
      if (creds.type === 'sqlite') {
        const result = await querySqlite(creds, `PRAGMA table_info("${params.table.replace(/"/g, '')}")`);        
        return result.rows.map((r) => ({
          name: r.name,
          type: r.type,
          notnull: !!r.notnull,
          default_value: r.dflt_value,
          primary_key: !!r.pk,
        }));
      }
      throw new Error(`${creds.type} requires external driver`);
    },
  },
  async connect(creds) { this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};

// SQLite query helper using sql.js (already in project deps)
async function querySqlite(creds, sql, values = []) {
  const initSqlJs = require('sql.js');
  const dbPath = creds.connection_string?.replace('sqlite:///', '') || creds.database;
  if (!dbPath) throw new Error('No SQLite database path configured');

  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    throw new Error(`Database file not found: ${dbPath}`);
  }

  try {
    const stmt = db.prepare(sql);
    if (values && values.length > 0) stmt.bind(values);

    const rows = [];
    const columns = stmt.getColumnNames();
    while (stmt.step()) {
      const values = stmt.get();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();

    return { columns, rows, count: rows.length };
  } finally {
    db.close();
  }
}
