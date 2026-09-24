import { DatabaseSync } from 'node:sqlite';

// Keep the existing D1/Drizzle call contract. All batch operations execute
// synchronously inside one SQLite transaction, with no interleaving awaits.
export class LocalDatabase {
  constructor(path) {
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  }
  prepare(sql) { return new LocalStatement(this, sql); }
  async batch(statements) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = statements.map(s => {
        if (s.db !== this) throw new Error('Cross-database batch');
        return s.execute();
      });
      this.sqlite.exec('COMMIT');
      return result;
    } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  async exec(sql) { this.sqlite.exec(sql); return { count: 1, duration: 0 }; }
  close() { this.sqlite.close(); }
}
class LocalStatement {
  constructor(db, sql, parameters = []) { Object.assign(this, { db, sql, parameters }); }
  bind(...values) {
    return new LocalStatement(this.db, this.sql, values.map(v => {
      if (v === undefined) throw new TypeError('Undefined SQL parameter');
      return Array.isArray(v) ? new Uint8Array(v) : typeof v === 'boolean' ? Number(v) : v;
    }));
  }
  execute() {
    const stmt = this.db.sqlite.prepare(this.sql);
    const before = this.db.sqlite.prepare('SELECT total_changes() AS n').get().n;
    const results = stmt.columns().length ? stmt.all(...this.parameters).map(r => ({...r})) : (stmt.run(...this.parameters), []);
    const info = this.db.sqlite.prepare('SELECT total_changes() AS n,last_insert_rowid() AS id').get();
    return { success: true, results, meta: { changes: Number(info.n - before), last_row_id: Number(info.id), duration: 0, changed_db: info.n !== before } };
  }
  async run() { return this.execute(); }
  async all() { return this.execute(); }
  async first(column) {
    const rows = this.execute().results;
    if (!rows.length) return null;
    if (column !== undefined && !(column in rows[0])) throw new Error('Unknown result column');
    return column === undefined ? rows[0] : rows[0][column];
  }
  async raw(options) {
    const stmt = this.db.sqlite.prepare(this.sql);
    const columns = stmt.columns().map(c => c.name);
    stmt.setReturnArrays(true);
    const rows = stmt.all(...this.parameters);
    return options?.columnNames ? [columns, ...rows] : rows;
  }
}
