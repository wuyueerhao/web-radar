import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function testDb(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0001_auth.sql', 'utf8'));
  db.exec(readFileSync('migrations/0010_user_management.sql','utf8').split('INSERT OR IGNORE')[0]);
  const prepare = (sql: string, args: unknown[] = []): D1PreparedStatement =>
    ({
      bind: (...values: unknown[]) => prepare(sql, values),
      async first(column?: string) {
        const row = db.prepare(sql).get(...(args as never[])) as
          Record<string, unknown> | undefined;
        return column ? (row?.[column] ?? null) : (row ?? null);
      },
      async all() {
        return { results: db.prepare(sql).all(...(args as never[])), success: true, meta: {} };
      },
      async run() {
        const r = db.prepare(sql).run(...(args as never[]));
        return { success: true, results: [], meta: { changes: Number(r.changes) } };
      },
      async raw() {
        return db
          .prepare(sql)
          .all(...(args as never[]))
          .map((r) => Object.values(r));
      },
    }) as unknown as D1PreparedStatement;
  return {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      db.exec('BEGIN');
      try {
        const result = [];
        for (const stmt of statements) result.push(await stmt.run());
        db.exec('COMMIT');
        return result;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as D1Database;
}
