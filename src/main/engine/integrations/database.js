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
      if (creds.type === 'postgresql') {
        const r = await queryPostgres(creds, 'SELECT version()');
        return { success: true, message: `PostgreSQL connected: ${r.rows?.[0]?.version?.slice(0, 40) || 'ok'}` };
      }
      if (creds.type === 'mysql') {
        const r = await queryMysql(creds, 'SELECT VERSION() AS version');
        return { success: true, message: `MySQL connected: ${r.rows?.[0]?.version || 'ok'}` };
      }
      return { success: false, message: `Unknown database type: ${creds.type}` };
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

      if (creds.type === 'sqlite') return querySqlite(creds, sql, values);
      if (creds.type === 'postgresql') return queryPostgres(creds, sql, values);
      if (creds.type === 'mysql') return queryMysql(creds, sql, values);
      throw new Error(`Unknown database type: ${creds.type}`);
    },

    list_tables: async (_params, creds) => {
      if (creds.type === 'sqlite') {
        const result = await querySqlite(creds, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        return result.rows.map((r) => r.name);
      }
      if (creds.type === 'postgresql') {
        const r = await queryPostgres(creds, "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        return r.rows.map((row) => row.name);
      }
      if (creds.type === 'mysql') {
        const r = await queryMysql(creds, 'SHOW TABLES');
        return r.rows.map((row) => Object.values(row)[0]);
      }
      throw new Error(`Unknown database type: ${creds.type}`);
    },

    describe_table: async (params, creds) => {
      if (!params.table) throw new Error('table parameter required');
      const table = params.table.replace(/[^A-Za-z0-9_]/g, '');
      if (creds.type === 'sqlite') {
        const result = await querySqlite(creds, `PRAGMA table_info("${table}")`);
        return result.rows.map((r) => ({ name: r.name, type: r.type, notnull: !!r.notnull, default_value: r.dflt_value, primary_key: !!r.pk }));
      }
      if (creds.type === 'postgresql') {
        const r = await queryPostgres(creds, `SELECT column_name AS name, data_type AS type, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [table]);
        return r.rows.map((row) => ({ name: row.name, type: row.type, notnull: row.is_nullable === 'NO', default_value: row.column_default, primary_key: false }));
      }
      if (creds.type === 'mysql') {
        const r = await queryMysql(creds, `DESCRIBE \`${table}\``);
        return r.rows.map((row) => ({ name: row.Field, type: row.Type, notnull: row.Null === 'NO', default_value: row.Default, primary_key: row.Key === 'PRI' }));
      }
      throw new Error(`Unknown database type: ${creds.type}`);
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

// PostgreSQL query helper using pg
async function queryPostgres(creds, sql, values = []) {
  let Client;
  try { ({ Client } = require('pg')); }
  catch (_) { throw new Error('pg driver not installed. Run: npm install pg'); }

  const config = creds.connection_string
    ? { connectionString: creds.connection_string }
    : {
        host: creds.host || 'localhost',
        port: Number(creds.port) || 5432,
        database: creds.database,
        user: creds.username,
        password: creds.password,
      };

  const client = new Client(config);
  await client.connect();
  try {
    const res = await client.query(sql, values && values.length ? values : undefined);
    return { columns: res.fields?.map((f) => f.name) || [], rows: res.rows || [], count: res.rowCount ?? (res.rows?.length || 0) };
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

// MySQL query helper using mysql2
async function queryMysql(creds, sql, values = []) {
  let mysql;
  try { mysql = require('mysql2/promise'); }
  catch (_) { throw new Error('mysql2 driver not installed. Run: npm install mysql2'); }

  const config = creds.connection_string
    ? { uri: creds.connection_string }
    : {
        host: creds.host || 'localhost',
        port: Number(creds.port) || 3306,
        database: creds.database,
        user: creds.username,
        password: creds.password,
      };

  const conn = await mysql.createConnection(config);
  try {
    const [rows, fields] = await conn.execute(sql, values || []);
    const isSelect = Array.isArray(rows);
    return {
      columns: fields?.map((f) => f.name) || (isSelect && rows[0] ? Object.keys(rows[0]) : []),
      rows: isSelect ? rows : [],
      count: isSelect ? rows.length : (rows.affectedRows ?? 0),
    };
  } finally {
    try { await conn.end(); } catch (_) {}
  }
}
